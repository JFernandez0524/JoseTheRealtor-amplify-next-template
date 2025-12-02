import { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
// 1. Import axios and Google library directly here
import axios from 'axios';
import { Client } from '@googlemaps/google-maps-services-js';

// --- Clients ---
const s3 = new S3Client();
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const googleClient = new Client({});

// --- Constants ---
const TABLE_NAME = process.env.AMPLIFY_DATA_LEAD_TABLE_NAME;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// --- Helper: Validate with Google (Copied Logic) ---
async function validateAddressWithGoogle(address: string) {
  console.log(`Validating address: ${address}`);
  try {
    const response = await googleClient.geocode({
      params: {
        key: GOOGLE_KEY!,
        address: address,
      },
      timeout: 5000,
    });

    if (response.data.results && response.data.results.length > 0) {
      const bestResult = response.data.results[0];

      // Parse components manually
      const components: any = {};
      bestResult.address_components.forEach((c) => {
        components[c.types[0]] = c.long_name;
      });

      // Build clean component object
      const cleanComponents = {
        street:
          `${components.street_number || ''} ${components.route || ''}`.trim(),
        city:
          components.locality || components.administrative_area_level_2 || '',
        state: components.administrative_area_level_1 || '',
        zip: components.postal_code || '',
      };

      return {
        success: true,
        formattedAddress: bestResult.formatted_address,
        location: bestResult.geometry.location,
        placeId: bestResult.place_id,
        components: cleanComponents,
      };
    }
    return null;
  } catch (e: any) {
    console.error(
      'Google API Error:',
      e.response?.data?.error_message || e.message
    );
    return null;
  }
}

// --- MAIN HANDLER ---
export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    try {
      console.log(`Processing S3 file: ${record.s3.object.key}`);

      // 1. Get Owner ID
      const ownerId = record.s3.object.key.split('/')[1];

      // 2. Get CSV Stream
      const getObjCommand = new GetObjectCommand({
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key,
      });
      const s3Response = await s3.send(getObjCommand);
      const s3Stream = s3Response.Body as Readable;

      // 3. Create Async Parser
      const parser = s3Stream.pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        })
      );

      console.log(`Starting stream processing...`);
      let count = 0;

      // 4. Iterate Async
      for await (const row of parser) {
        count++;

        // Map Headers
        const firstName = row['ownerFirstName'];
        const lastName = row['ownerLastName'];
        const rawAddress = row['ownerAddress'];
        const rawCity = row['ownerCity'];
        const rawState = row['ownerState'];
        const rawZip = row['ownerZip'];

        // We also need to get the type if it's in the CSV, or default it
        // (Assuming we passed it via metadata, but accessing metadata from event is hard)
        // For now, defaulting to PREFORECLOSURE as you had it.
        const type = 'PREFORECLOSURE';

        // Construct search string
        const fullSearchAddress = `${rawAddress}, ${rawCity}, ${rawState} ${rawZip}`;

        // A. Validate
        const validation = await validateAddressWithGoogle(fullSearchAddress);

        if (!validation || !validation.success) {
          console.warn(
            `Skipping invalid address (Row ${count}): ${fullSearchAddress}`
          );
          continue;
        }

        // B. Save to DynamoDB
        const now = new Date().toISOString();
        const item = {
          id: randomUUID(),
          owner: ownerId,
          __typename: 'Lead',

          type: type,

          ownerFirstName: firstName,
          ownerLastName: lastName,

          // Validated Address
          ownerAddress: validation.components.street,
          ownerCity: validation.components.city,
          ownerState: validation.components.state,
          ownerZip: validation.components.zip,
          standardizedAddress: validation.components,
          latitude: validation.location.lat,
          longitude: validation.location.lng,

          skipTraceStatus: 'PENDING',

          createdAt: now,
          updatedAt: now,
        };

        await ddbDocClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
          })
        );
      }

      console.log(`Processing complete. Processed ${count} rows.`);
    } catch (error) {
      console.error('Fatal handler error:', error);
    }
  }
};
