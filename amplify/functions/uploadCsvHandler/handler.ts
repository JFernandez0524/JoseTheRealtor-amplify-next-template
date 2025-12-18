// amplify/functions/uploadCsvHandler/handler.ts

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
 * 🛠️ SANITIZATION & FORMATTING UTILITIES
 */
const sanitize = (val: any, maxLen = 255): string => {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags to prevent XSS
    .substring(0, maxLen);
};

// 🎯 Standards phone numbers to E.164 (+1XXXXXXXXXX) for GHL
const formatPhoneNumber = (val: any): string | null => {
  const s = sanitize(val, 20).replace(/\D/g, ''); // Keep only digits
  if (s.length === 10) return `+1${s}`;
  if (s.length === 11 && s.startsWith('1')) return `+${s}`;
  return null;
};

// 🎯 Handles NJ ZIP codes by padding leading zeros (e.g., 7110 -> 07110)
const formatZip = (val: any): string => {
  const s = sanitize(val, 10).replace(/\D/g, ''); // Keep only digits
  if (s.length > 0 && s.length < 5) return s.padStart(5, '0');
  return s;
};

const formatName = (val: any): string => {
  const s = sanitize(val, 50);
  if (!s) return '';
  // Converts "JOHN" to "John" for better marketing look
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    let bucketName = record.s3.bucket.name;
    let decodedKey = decodeURIComponent(record.s3.object.key).replace(
      /\+/g,
      ' '
    );

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
          // formatName handles the "Proper Case" transformation
          const firstName = formatName(
            row['ownerFirstName'] || row['First Name']
          );
          const lastName = formatName(row['ownerLastName'] || row['Last Name']);

          if (/<script|javascript:|on\w+=/i.test(JSON.stringify(row))) {
            throw new Error('Potential harmful script detected.');
          }

          const rawPropAddr = sanitize(
            row['ownerAddress'] || row['Property Address']
          );
          const rawPropCity = sanitize(row['ownerCity'] || row['City'], 100);
          const rawPropState = sanitize(
            row['ownerState'] || row['State'],
            2
          ).toUpperCase();
          const rawPropZip = formatZip(row['ownerZip'] || row['Zip']); // 🎯 Fix missing leading zero

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

          // --- C. PROBATE ADMIN LOGIC ---
          let finalMailAddr = null;
          let finalMailCity = null;
          let finalMailState = null;
          let finalMailZip = null;
          let adminFirstName = null;
          let adminLastName = null;
          const labels: string[] = [leadType];

          if (leadType === 'PROBATE') {
            adminFirstName = formatName(row['adminFirstName']);
            adminLastName = formatName(row['adminLastName']);

            const rawAdminAddr = sanitize(
              row['adminAddress'] || row['Mailing Address']
            );
            const rawAdminCity = sanitize(row['adminCity'], 100);
            const rawAdminState = sanitize(row['adminState'], 2).toUpperCase();
            const rawAdminZip = formatZip(row['adminZip']); // 🎯 Also fix for admin zip

            if (rawAdminAddr) {
              const fullAdminString = `${rawAdminAddr}, ${rawAdminCity}, ${rawAdminState} ${rawAdminZip}`;
              const adminValidation =
                await validateAddressWithGoogle(fullAdminString);

              finalMailAddr = adminValidation
                ? adminValidation.components.street
                : rawAdminAddr;
              finalMailCity = adminValidation
                ? adminValidation.components.city
                : rawAdminCity;
              finalMailState = adminValidation
                ? adminValidation.components.state
                : rawAdminState;
              finalMailZip = adminValidation
                ? adminValidation.components.zip
                : rawAdminZip;

              labels.push('ABSENTEE');
            }
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

          // --- E. PHONE & SKIPTRACE LOGIC ---
          const preSkiptracedPhone = formatPhoneNumber(row['phone']);
          const isPreSkiptraced = !!preSkiptracedPhone;

          // --- F. SAVE TO DYNAMODB ---
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
            adminFirstName,
            adminLastName,
            adminAddress: finalMailAddr,
            adminCity: finalMailCity,
            adminState: finalMailState,
            adminZip: finalMailZip,
            isAbsenteeOwner: labels.includes('ABSENTEE'),
            leadLabels: labels,
            validationStatus: propValidation ? 'VALID' : 'INVALID',
            phone: preSkiptracedPhone,
            phones: preSkiptracedPhone ? [preSkiptracedPhone] : [],
            emails: row['email']
              ? [sanitize(row['email'], 100).toLowerCase()]
              : [],
            // 🎯 Automatically mark COMPLETED if phone was provided in CSV
            skipTraceStatus: isPreSkiptraced ? 'COMPLETED' : 'PENDING',
            ghlSyncStatus: 'PENDING',
            ghlContactId: null,
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

      // --- G. FINALIZATION ---
      if (validationErrors.length === 0) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
        );
        await sendNotification(
          ownerId,
          'Upload Complete',
          `Imported ${successCount} leads.`
        );
        await logAuditEvent('CSV_IMPORT_SUCCESS', {
          ownerId,
          fileName: decodedKey,
          count: successCount,
        });
      } else {
        await sendNotification(
          ownerId,
          'Upload Action Required',
          `Processed ${successCount} leads, ${validationErrors.length} failed.`
        );
      }
    } catch (err: any) {
      console.error('Critical Processing Error:', err);
    }
  }
};
