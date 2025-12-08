import { S3Handler } from 'aws-lambda';
// 👇 Added DeleteObjectCommand
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// 👇 Added QueryCommand
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
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
    let bucketName = '';
    let decodedKey = '';

    try {
      const rawKey = record.s3.object.key;
      decodedKey = decodeURIComponent(rawKey).replace(/\+/g, ' ');
      bucketName = record.s3.bucket.name;

      console.log(`📂 Processing file: ${decodedKey}`);

      // Debugging the API Key
      const key = process.env.GOOGLE_MAPS_API_KEY || '';
      console.log(`🔑 Key Length: ${key.length}`);
      console.log(`🔑 Key First 4: ${key.substring(0, 4)}`);
      console.log(`🔑 Key Last 4: ${key.substring(key.length - 4)}`);

      // 1. Get Metadata
      const headObject = await s3.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: decodedKey,
        })
      );

      const ownerId = headObject.Metadata?.['owner_sub'];
      const leadType = headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE';

      if (!ownerId) {
        console.warn('⚠️ No owner_sub found. Skipping.');
        continue;
      }

      // 2. Download CSV
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: decodedKey,
        })
      );
      const stream = response.Body as Readable;

      const parser = stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        })
      );

      let count = 0;
      let skippedCount = 0;

      for await (const row of parser) {
        const rawAddress =
          row['ownerAddress'] || row['Property Address'] || row['Address'];
        const rawCity = row['ownerCity'] || row['City'];
        const rawState = row['ownerState'] || row['State'];
        const rawZip = row['ownerZip'] || row['Zip'];
        const fullSearchAddress = `${rawAddress}, ${rawCity}, ${rawState} ${rawZip}`;

        let validationResult = null;
        try {
          if (rawAddress) {
            validationResult =
              await validateAddressWithGoogle(fullSearchAddress);
          }
        } catch (error) {
          console.warn(`⚠️ Validation Failed: ${fullSearchAddress}`);
        }

        // Use standardized address (critical for duplicate detection)
        const finalAddress = validationResult?.components.street || rawAddress;

        if (!finalAddress) continue;

        // 🛑 DUPLICATE CHECK 🛑
        // "Does this user already have this exact address?"
        const existingCheck = await ddbDocClient.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'propertyLeadsByOwnerAndOwnerAddress', // Using our new index
            KeyConditionExpression: '#owner = :owner AND #addr = :addr',
            ExpressionAttributeNames: {
              '#owner': 'owner',
              '#addr': 'ownerAddress',
            },
            ExpressionAttributeValues: {
              ':owner': ownerId,
              ':addr': finalAddress,
            },
            Limit: 1, // We only need to find one to know it's a dupe
          })
        );

        if (existingCheck.Items && existingCheck.Items.length > 0) {
          console.log(`⏭️ Skipping duplicate: ${finalAddress}`);
          skippedCount++;
          continue; // Skip to next row
        }

        // Not a duplicate? Save it!
        count++;
        const leadItem = {
          id: randomUUID(),
          owner: ownerId,
          __typename: 'PropertyLead',
          type: leadType,

          ownerFirstName: row['First Name'] || row['ownerFirstName'],
          ownerLastName: row['Last Name'] || row['ownerLastName'],

          ownerAddress: finalAddress,
          ownerCity: validationResult?.components.city || rawCity,
          ownerState: validationResult?.components.state || rawState,
          ownerZip: validationResult?.components.zip || rawZip,

          standardizedAddress: validationResult?.components || null,
          latitude: validationResult?.location.lat || null,
          longitude: validationResult?.location.lng || null,

          skipTraceStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),

          adminFirstName: row['adminFirstName'],
          adminLastName: row['adminLastName'],
          adminAddress: row['adminAddress'],
          adminCity: row['adminCity'],
          adminState: row['adminState'],
          adminZip: row['adminZip'],
        };

        await ddbDocClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: leadItem,
          })
        );

        // Integrations (Run in background)
        Promise.all([
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
        ]).catch((e) => console.error('Integration Error:', e));
      }

      console.log(
        `✅ Done. Saved: ${count}, Duplicates Skipped: ${skippedCount}`
      );

      // 🗑️ DELETE FILE FROM S3
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: decodedKey,
        })
      );
      console.log(`🗑️ Cleaned up S3 file: ${decodedKey}`);
    } catch (err) {
      console.error('❌ Error processing file:', err);
    }
  }
};
