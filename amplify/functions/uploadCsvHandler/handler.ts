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

const sanitize = (val: any, maxLen = 255): string => {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/<[^>]*>?/gm, '')
    .substring(0, maxLen);
};

const formatPhoneNumber = (val: any): string | null => {
  const s = sanitize(val, 20).replace(/\D/g, '');
  if (s.length === 10) return `+1${s}`;
  if (s.length === 11 && s.startsWith('1')) return `+${s}`;
  return null;
};

const formatZip = (val: any): string => {
  const s = sanitize(String(val), 10).replace(/\D/g, '');
  if (s.length > 0 && s.length < 5) return s.padStart(5, '0');
  return s;
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
    const validationErrors: { row: number; error: string }[] = [];
    let currentRow = 0,
      successCount = 0,
      skippedCount = 0,
      ownerId = '';

    console.log(`🚀 Starting processing for file: ${decodedKey}`);

    try {
      const headObject = await s3.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );
      ownerId = headObject.Metadata?.['owner_sub'] || '';
      const leadType = (
        headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE'
      ).toUpperCase();

      if (!ownerId) throw new Error('No owner_sub found in file metadata.');

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
          const firstName = formatName(
            row['ownerFirstName'] || row['First Name']
          );
          const lastName = formatName(row['ownerLastName'] || row['Last Name']);
          const rawPropZip = formatZip(row['ownerZip'] || row['Zip']);
          const rawPropAddr = sanitize(
            row['ownerAddress'] || row['Property Address']
          );

          // --- 🔍 LOG: GOOGLE ADDRESS VALIDATION START ---
          const fullPropString = `${rawPropAddr}, ${sanitize(row['ownerCity'])}, ${sanitize(row['ownerState'])} ${rawPropZip}`;
          console.log(
            `[Row ${currentRow}] Validating Property Address: ${fullPropString}`
          );

          const propValidation =
            await validateAddressWithGoogle(fullPropString);
          if (propValidation) {
            console.log(
              `[Row ${currentRow}] ✅ Google Match: ${propValidation.formattedAddress}`
            );
          } else {
            console.warn(
              `[Row ${currentRow}] ⚠️ Google No Match. Using raw CSV values.`
            );
          }

          const finalPropAddr = propValidation
            ? propValidation.components.street
            : rawPropAddr;
          const finalPropZip = propValidation
            ? propValidation.components.zip
            : rawPropZip;

          let finalMailAddr = null,
            finalMailCity = null,
            finalMailState = null,
            finalMailZip = null;
          let adminFirstName = null,
            adminLastName = null;
          const labels: string[] = [leadType];

          if (leadType === 'PROBATE') {
            adminFirstName = formatName(row['adminFirstName']);
            adminLastName = formatName(row['adminLastName']);
            const rawAdminZip = formatZip(row['adminZip']);
            const rawAdminAddr = sanitize(
              row['adminAddress'] || row['Mailing Address']
            );

            if (rawAdminAddr) {
              console.log(
                `[Row ${currentRow}] Validating Admin/Mailing Address...`
              );
              const adminValidation = await validateAddressWithGoogle(
                `${rawAdminAddr}, ${sanitize(row['adminCity'])} ${rawAdminZip}`
              );

              finalMailAddr = adminValidation
                ? adminValidation.components.street
                : rawAdminAddr;
              finalMailCity = adminValidation
                ? adminValidation.components.city
                : sanitize(row['adminCity']);
              finalMailState = adminValidation
                ? adminValidation.components.state
                : sanitize(row['adminState']);
              finalMailZip = adminValidation
                ? adminValidation.components.zip
                : rawAdminZip;
              labels.push('ABSENTEE');
            }
          }

          const preSkiptracedPhone = formatPhoneNumber(row['phone']);
          console.log(
            `[Row ${currentRow}] Phone: ${preSkiptracedPhone || 'NONE'} | Status: ${preSkiptracedPhone ? 'COMPLETED' : 'PENDING'}`
          );

          const leadItem = {
            id: randomUUID(),
            owner: ownerId,
            __typename: 'PropertyLead',
            type: leadType,
            ownerFirstName: firstName,
            ownerLastName: lastName,
            ownerAddress: finalPropAddr,
            ownerCity: propValidation
              ? propValidation.components.city
              : sanitize(row['ownerCity']),
            ownerState: propValidation
              ? propValidation.components.state
              : sanitize(row['ownerState']),
            ownerZip: finalPropZip,
            adminFirstName,
            adminLastName,
            adminAddress: finalMailAddr,
            adminCity: finalMailCity,
            adminState: finalMailState,
            adminZip: finalMailZip,
            // 🎯 Fixed: Ensure Probate Mailing info is saved to these core fields
            mailingAddress: finalMailAddr,
            mailingCity: finalMailCity,
            mailingState: finalMailState,
            mailingZip: finalMailZip,
            isAbsenteeOwner: labels.includes('ABSENTEE'),
            leadLabels: labels,
            phone: preSkiptracedPhone,
            phones: preSkiptracedPhone ? [preSkiptracedPhone] : [],
            skipTraceStatus: preSkiptracedPhone ? 'COMPLETED' : 'PENDING',
            ghlSyncStatus: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await ddbDocClient.send(
            new PutCommand({ TableName: TABLE_NAME, Item: leadItem })
          );
          successCount++;
        } catch (rowError: any) {
          console.error(`[Row ${currentRow}] Row Error: ${rowError.message}`);
          validationErrors.push({ row: currentRow, error: rowError.message });
        }
      }

      console.log(
        `🏁 Finished file: ${successCount} successful, ${validationErrors.length} failed.`
      );
      if (validationErrors.length === 0) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
        );
      }
    } catch (err: any) {
      console.error('❌ Critical Processing Error:', err);
    }
  }
};
