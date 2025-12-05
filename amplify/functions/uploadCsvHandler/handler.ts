import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

// 👇 Import your centralized Google Validator
// (Relative path assumes: amplify/functions/uploadCsvHandler/handler.ts)
import { validateAddressWithGoogle } from '../../../app/utils/google.server';

// Integrations
import { syncToKVCore } from './src/intergrations/kvcore';
import { syncToGoHighLevel } from './src/intergrations/gohighlevel';
import { sendNotification } from './src/intergrations/notifications';
import { logAuditEvent } from './src/intergrations/auditLogs';

const s3 = new S3Client({});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    try {
      // 1. Decode Key
      const rawKey = record.s3.object.key;
      const decodedKey = decodeURIComponent(rawKey).replace(/\+/g, ' ');
      console.log(`📂 Processing file: ${decodedKey}`);

      // 2. Fetch Metadata (User ID)
      const headObject = await s3.send(
        new HeadObjectCommand({
          Bucket: record.s3.bucket.name,
          Key: decodedKey,
        })
      );

      const ownerId = headObject.Metadata?.['owner_sub'];
      const leadType = headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE'; // Default or from metadata

      if (!ownerId) {
        console.warn(
          '⚠️ No owner_sub found in metadata. Skipping file to prevent ghost data.'
        );
        continue;
      }

      console.log(`👤 Owner Identified: ${ownerId}`);

      // 3. Download CSV
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: record.s3.bucket.name,
          Key: decodedKey,
        })
      );
      const stream = response.Body as Readable;

      // 4. Parse CSV
      const parser = stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        })
      );

      let count = 0;
      for await (const row of parser) {
        count++;

        // Map CSV headers to variables
        const rawAddress =
          row['ownerAddress'] || row['Property Address'] || row['Address'];
        const rawCity = row['ownerCity'] || row['City'];
        const rawState = row['ownerState'] || row['State'];
        const rawZip = row['ownerZip'] || row['Zip'];

        // Construct search string
        const fullSearchAddress = `${rawAddress}, ${rawCity}, ${rawState} ${rawZip}`;

        let validationResult = null;

        // 5. 👇 Validate with Google (Using Shared Utility)
        try {
          if (rawAddress) {
            validationResult =
              await validateAddressWithGoogle(fullSearchAddress);
          }
        } catch (error) {
          console.warn(
            `⚠️ Google Validation Failed for row ${count}: ${fullSearchAddress}`
          );
          // We continue processing, just without validation data
        }

        const leadItem = {
          id: randomUUID(),
          owner: ownerId,
          __typename: 'Lead',
          type: leadType,

          ownerFirstName: row['First Name'] || row['ownerFirstName'],
          ownerLastName: row['Last Name'] || row['ownerLastName'],

          // Use Validated Data if available, otherwise raw CSV data
          ownerAddress: validationResult?.components.street || rawAddress,
          ownerCity: validationResult?.components.city || rawCity,
          ownerState: validationResult?.components.state || rawState,
          ownerZip: validationResult?.components.zip || rawZip,

          // Save the standardized object
          standardizedAddress: validationResult?.components || null,
          latitude: validationResult?.location.lat || null,
          longitude: validationResult?.location.lng || null,

          skipTraceStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),

          // Admin fields mapping (if present in CSV)
          adminFirstName: row['adminFirstName'],
          adminLastName: row['adminLastName'],
          adminAddress: row['adminAddress'],
          adminCity: row['adminCity'],
          adminState: row['adminState'],
          adminZip: row['adminZip'],
        };

        // 6. Save to DynamoDB
        await ddbDocClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: leadItem,
          })
        );

        // 7. Integrations
        await Promise.all([
          syncToKVCore(leadItem).catch((e) => console.error('KVCore Fail:', e)),
          syncToGoHighLevel(leadItem).catch((e) =>
            console.error('GHL Fail:', e)
          ),
          sendNotification(leadItem, 'Lead Imported via CSV').catch((e) =>
            console.error('Notify Fail:', e)
          ),
          logAuditEvent(leadItem, 'CSV_IMPORT').catch((e) =>
            console.error('Audit Fail:', e)
          ),
        ]);
      }
      console.log(`✅ Success! Processed ${count} leads for owner: ${ownerId}`);
    } catch (err) {
      console.error('❌ Error processing file:', err);
    }
  }
};
