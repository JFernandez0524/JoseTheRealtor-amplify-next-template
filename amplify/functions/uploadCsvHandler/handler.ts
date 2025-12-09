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

// 🟢 CHANGED: Removed CRM Sync imports (KVCore/GHL)
// We only keep notifications and auditing for now
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
        // 1. Extract Raw Data
        const rawAddress =
          row['ownerAddress'] || row['Property Address'] || row['Address'];
        const rawCity = row['ownerCity'] || row['City'];
        const rawState = row['ownerState'] || row['State'];
        const rawZip = row['ownerZip'] || row['Zip'];

        // Fallback for full search string
        const fullSearchAddress = `${rawAddress}, ${rawCity}, ${rawState} ${rawZip}`;

        if (!rawAddress) continue; // Skip ONLY if there is no address at all

        // 2. Attempt Google Validation
        let validationResult = null;
        try {
          validationResult = await validateAddressWithGoogle(fullSearchAddress);
        } catch (error) {
          console.warn(`Validation crashed for ${fullSearchAddress}`);
        }

        // 3. Determine Status & Data Source
        // If Google worked, use Google data. If not, use Raw CSV data.
        const isAddressValid = !!validationResult;

        const finalAddress = validationResult
          ? validationResult.components.street
          : rawAddress;
        const finalCity = validationResult
          ? validationResult.components.city
          : rawCity;
        const finalState = validationResult
          ? validationResult.components.state
          : rawState;
        const finalZip = validationResult
          ? validationResult.components.zip
          : rawZip;
        // 4. Duplicate Check (Logic remains the same)
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
              ':addr': finalAddress,
            },
            Limit: 1,
          })
        );

        if (existingCheck.Items && existingCheck.Items.length > 0) {
          console.log(`⏭️ Skipping duplicate: ${finalAddress}`);
          skippedCount++;
          continue;
        }

        // 5. Prepare Item
        count++;
        const emailArray = row['email'] ? [row['email']] : [];
        const phoneArray = row['phone'] ? [row['phone']] : [];

        const leadItem = {
          id: randomUUID(),
          owner: ownerId,
          __typename: 'PropertyLead',
          type: leadType,

          ownerFirstName: row['First Name'] || row['ownerFirstName'],
          ownerLastName: row['Last Name'] || row['ownerLastName'],

          // 🟢 SAVE EITHER VALIDATED OR RAW ADDRESS
          ownerAddress: finalAddress,
          ownerCity: finalCity,
          ownerState: finalState,
          ownerZip: finalZip,

          // 🟢 NEW STATUS FIELD
          validationStatus: isAddressValid ? 'VALID' : 'INVALID',

          // Save Coords only if valid
          latitude: validationResult?.location?.lat || null,
          longitude: validationResult?.location?.lng || null,
          standardizedAddress: validationResult?.components || null,

          // Standard Fields
          emails: emailArray,
          phones: phoneArray,
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

        // 🟢 CHANGED: Removed syncToKVCore and syncToGoHighLevel
        // We only notify the user and log the audit event.
        Promise.all([
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
