import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { validateAddressWithGoogle } from '../../../app/utils/google.server';
import { sendNotification } from './src/intergrations/notifications';
import { logAuditEvent } from './src/intergrations/auditLogs';

const s3 = new S3Client({});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;

/**
 * 🛠️ SANITIZATION UTILITIES
 */
const sanitize = (val: any, maxLen = 255): string => {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags to prevent XSS
    .substring(0, maxLen);
};

const formatName = (val: any): string => {
  const s = sanitize(val, 50);
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    let bucketName = record.s3.bucket.name;
    let decodedKey = decodeURIComponent(record.s3.object.key).replace(
      /\+/g,
      ' '
    );

    // Tracking for user feedback
    const validationErrors: { row: number; error: string }[] = [];
    let currentRow = 0;
    let successCount = 0;
    let skippedCount = 0;
    let ownerId = '';

    try {
      // 1. Get Metadata & Lead Type
      const headObject = await s3.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );

      ownerId = headObject.Metadata?.['owner_sub'] || '';
      const leadType = (
        headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE'
      ).toUpperCase();

      if (!ownerId) {
        throw new Error(
          'No owner_sub found in file metadata. Security rejection.'
        );
      }

      // 2. Download & Parse CSV
      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );
      const stream = response.Body as Readable;
      const parser = stream.pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true, bom: true })
      );

      for await (const row of parser) {
        currentRow++;
        try {
          // --- A. SANITIZED CORE INPUTS ---
          const firstName = formatName(
            row['ownerFirstName'] || row['First Name'] || row['First_Name']
          );
          const lastName = formatName(
            row['ownerLastName'] || row['Last Name'] || row['Last_Name']
          );

          // Basic Harmful Text Check (XSS/Script injection protection)
          if (/<script|javascript:|on\w+=/i.test(JSON.stringify(row))) {
            throw new Error(
              'Potential harmful script or malformed characters detected.'
            );
          }

          const rawPropAddr = sanitize(
            row['ownerAddress'] || row['Property Address'] || row['Address']
          );
          const rawPropCity = sanitize(row['ownerCity'] || row['City'], 100);
          const rawPropState = sanitize(
            row['ownerState'] || row['State'],
            2
          ).toUpperCase();
          const rawPropZip = sanitize(row['ownerZip'] || row['Zip'], 10);

          if (!rawPropAddr) throw new Error('Property Address is missing.');

          // --- B. ADDRESS VALIDATION ---
          const fullPropString = `${rawPropAddr}, ${rawPropCity}, ${rawPropState} ${rawPropZip}`;
          const propValidation =
            await validateAddressWithGoogle(fullPropString);

          const finalPropAddr = propValidation
            ? propValidation.components.street
            : rawPropAddr;
          const finalPropCity = propValidation
            ? propValidation.components.city
            : rawPropCity;
          const finalPropState = propValidation
            ? propValidation.components.state
            : rawPropState;
          const finalPropZip = propValidation
            ? propValidation.components.zip
            : rawPropZip;

          // --- C. MAILING ADDRESS & LABEL LOGIC ---
          let finalMailAddr = null;
          let finalMailCity = null;
          let finalMailState = null;
          let finalMailZip = null;
          const labels: string[] = [leadType];

          if (leadType === 'PROBATE') {
            const rawAdminAddr = sanitize(
              row['adminAddress'] || row['Mailing Address']
            );
            if (rawAdminAddr) {
              const fullAdminString = `${rawAdminAddr}, ${row['adminCity']}, ${row['adminState']} ${row['adminZip']}`;
              const adminValidation =
                await validateAddressWithGoogle(fullAdminString);
              finalMailAddr = adminValidation
                ? adminValidation.components.street
                : rawAdminAddr;
              labels.push('ABSENTEE');
            }
          } else if (row['mailingAddress']) {
            finalMailAddr = sanitize(row['mailingAddress']);
            labels.push('ABSENTEE');
          }

          // --- D. DUPLICATE CHECK ---
          const existingCheck = await ddbDocClient.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              IndexName: 'propertyLeadsByOwnerAndOwnerAddress',
              KeyConditionExpression: '#owner = :owner AND #addr = :addr',
              ExpressionAttributeNames: {
                '#owner': 'owner',
                '#addr': 'ownerAddress',
              },
              ExpressionAttributeValues: {
                ':owner': ownerId,
                ':addr': finalPropAddr,
              },
              Limit: 1,
            })
          );

          if (existingCheck.Items && existingCheck.Items.length > 0) {
            skippedCount++;
            continue;
          }

          // --- E. SAVE TO DYNAMODB ---
          const leadItem = {
            id: randomUUID(),
            owner: ownerId,
            __typename: 'PropertyLead',
            type: leadType,
            ownerFirstName: firstName,
            ownerLastName: lastName,
            ownerAddress: finalPropAddr,
            ownerCity: finalPropCity,
            ownerState: finalPropState,
            ownerZip: finalPropZip,
            leadLabels: labels,
            validationStatus: propValidation ? 'VALID' : 'INVALID',
            phones: row['phone'] ? [sanitize(row['phone'], 20)] : [],
            emails: row['email']
              ? [sanitize(row['email'], 100).toLowerCase()]
              : [],
            skipTraceStatus: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await ddbDocClient.send(
            new PutCommand({ TableName: TABLE_NAME, Item: leadItem })
          );
          successCount++;
        } catch (rowError: any) {
          validationErrors.push({ row: currentRow, error: rowError.message });
        }
      }

      // --- F. FINALIZATION ---
      if (validationErrors.length === 0) {
        // FULL SUCCESS: Delete the file from S3
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
        );
        await sendNotification(
          ownerId,
          'Upload Complete',
          `Successfully imported ${successCount} leads.`
        );
        await logAuditEvent('CSV_IMPORT_SUCCESS', {
          ownerId,
          fileName: decodedKey,
          count: successCount,
        });
      } else {
        // PARTIAL FAILURE: Keep file and notify user
        const errorSummary = validationErrors
          .slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.error}`)
          .join('\n');
        await sendNotification(
          ownerId,
          'Upload Action Required',
          `Processed ${successCount} leads, but ${validationErrors.length} failed validation. The file was NOT deleted. Please fix errors and re-upload.\n\nSample Errors:\n${errorSummary}`
        );
        await logAuditEvent('CSV_IMPORT_PARTIAL_FAILURE', {
          ownerId,
          fileName: decodedKey,
          errorCount: validationErrors.length,
        });
      }
    } catch (err: any) {
      console.error('Critical Processing Error:', err);
      if (ownerId) {
        await sendNotification(
          ownerId,
          'Upload Failed',
          `A critical error occurred: ${err.message}. Please check your CSV format.`
        );
      }
    }
  }
};
