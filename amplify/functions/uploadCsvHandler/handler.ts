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
      // 1. Decode the key
      const rawKey = record.s3.object.key;
      const decodedKey = decodeURIComponent(rawKey).replace(/\+/g, ' ');
      console.log(`📂 Processing file: ${decodedKey}`);

      // 2. 👇 FETCH METADATA (This is the fix)
      // We need the 'owner_sub' (User ID) that the frontend sent
      const headObject = await s3.send(
        new HeadObjectCommand({
          Bucket: record.s3.bucket.name,
          Key: decodedKey,
        })
      );

      // S3 lowercases metadata keys automatically
      const ownerId = headObject.Metadata?.['owner_sub'];

      if (!ownerId) {
        console.warn(
          '⚠️ No owner_sub found in metadata. Falling back to path ID (might cause visibility issues).'
        );
        // Fallback to the old way if metadata is missing (just in case)
        // But this usually means the dashboard won't see it.
      } else {
        console.log(`👤 Owner Identified from Metadata: ${ownerId}`);
      }

      // Use the metadata ID if available, otherwise fall back to path
      const finalOwnerId = ownerId || decodedKey.split('/')[1];

      // 3. Download CSV
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: record.s3.bucket.name,
          Key: decodedKey,
        })
      );
      const stream = response.Body as Readable;

      // 4. Parse & Save
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

        const leadItem = {
          id: randomUUID(),
          owner: finalOwnerId, // 👈 Using the correct User ID
          __typename: 'Lead',
          type: 'PREFORECLOSURE',

          ownerFirstName: row['First Name'] || row['ownerFirstName'],
          ownerLastName: row['Last Name'] || row['ownerLastName'],
          ownerAddress: row['Property Address'] || row['ownerAddress'],
          ownerCity: row['City'] || row['ownerCity'],
          ownerState: row['State'] || row['ownerState'],
          ownerZip: row['Zip'] || row['ownerZip'],

          skipTraceStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await ddbDocClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: leadItem,
          })
        );

        // Integrations...
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
      console.log(
        `✅ Success! Processed ${count} leads for owner: ${finalOwnerId}`
      );
    } catch (err) {
      console.error('❌ Error processing file:', err);
    }
  }
};
