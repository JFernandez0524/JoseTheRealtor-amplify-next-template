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
import { validateAddressWithGoogle } from '../../../app/utils/google.server'; // Ensure this path is correct
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

      // 1. Get Metadata & Lead Type
      const headObject = await s3.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );

      const ownerId = headObject.Metadata?.['owner_sub'];
      // Default to PREFORECLOSURE if missing
      const leadType = (
        headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE'
      ).toUpperCase();

      if (!ownerId) {
        console.warn('⚠️ No owner_sub found. Skipping.');
        continue;
      }

      // 2. Download & Parse CSV
      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );
      const stream = response.Body as Readable;
      const parser = stream.pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true, bom: true })
      );

      let count = 0;
      let skippedCount = 0;

      for await (const row of parser) {
        // --- A. PROPERTY ADDRESS VALIDATION (Always Required) ---
        const rawPropAddr =
          row['ownerAddress'] || row['Property Address'] || row['Address'];
        const rawPropCity = row['ownerCity'] || row['City'];
        const rawPropState = row['ownerState'] || row['State'];
        const rawPropZip = row['ownerZip'] || row['Zip'];

        if (!rawPropAddr) continue;

        const fullPropString = `${rawPropAddr}, ${rawPropCity}, ${rawPropState} ${rawPropZip}`;
        const propValidation = await validateAddressWithGoogle(fullPropString);

        // Fallback if validation fails
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

        // --- B. MAILING ADDRESS LOGIC (Based on Lead Type) ---
        let finalMailAddr = null;
        let finalMailCity = null;
        let finalMailState = null;
        let finalMailZip = null;
        let isAbsentee = false;

        // If PROBATE: Validate the ADMIN address
        if (leadType === 'PROBATE') {
          const rawAdminAddr = row['adminAddress'] || row['Mailing Address'];
          const rawAdminCity = row['adminCity'] || row['Mailing City'];
          const rawAdminState = row['adminState'] || row['Mailing State'];
          const rawAdminZip = row['adminZip'] || row['Mailing Zip'];

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

            // For Probate, we always consider them "Absentee" effectively because we mail the Admin
            isAbsentee = true;
          }
        }
        // If PRE-FORECLOSURE: Only set if explicitly provided in CSV (e.g. separate mailing column)
        else {
          const rawMailAddr = row['mailingAddress']; // Optional CSV column
          if (rawMailAddr) {
            // ... (Optional: Validate mailing address if provided) ...
            // For now, if provided in CSV, we assume it might be absentee
            finalMailAddr = rawMailAddr;
            // ... map other fields ...
            isAbsentee = true;
          }
          // Otherwise, leave finalMailAddr NULL.
          // We will NOT default it to Property Address so we can detect absentee status later.
        }

        // --- C. DUPLICATE CHECK (On Property Address) ---
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

        // --- D. SAVE TO DB ---
        count++;
        const leadItem = {
          id: randomUUID(),
          owner: ownerId,
          __typename: 'PropertyLead',
          type: leadType, // 'PROBATE' or 'PREFORECLOSURE'

          // 1. Property Info (The House)
          ownerFirstName: row['First Name'] || row['ownerFirstName'],
          ownerLastName: row['Last Name'] || row['ownerLastName'],
          ownerAddress: finalPropAddr,
          ownerCity: finalPropCity,
          ownerState: finalPropState,
          ownerZip: finalPropZip,

          // 2. Admin Info (For Probate)
          adminFirstName: row['adminFirstName'],
          adminLastName: row['adminLastName'],
          adminAddress: row['adminAddress'], // Raw input preserved
          adminCity: row['adminCity'],
          adminState: row['adminState'],
          adminZip: row['adminZip'],

          // 3. Mailing Info (Who we contact)
          mailingAddress: finalMailAddr,
          mailingCity: finalMailCity,
          mailingState: finalMailState,
          mailingZip: finalMailZip,
          isAbsenteeOwner: isAbsentee,

          // 4. Status & System
          validationStatus: propValidation ? 'VALID' : 'INVALID', // Valid Property?
          latitude: propValidation?.location?.lat || null,
          longitude: propValidation?.location?.lng || null,
          standardizedAddress: propValidation?.components || null,

          phones: row['phone'] ? [row['phone']] : [],
          emails: row['email'] ? [row['email']] : [],
          skipTraceStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await ddbDocClient.send(
          new PutCommand({ TableName: TABLE_NAME, Item: leadItem })
        );

        // ... notifications ...
      }
      // ... cleanup s3 ...
    } catch (err) {
      console.error('Processing Error:', err);
    }
  }
};
