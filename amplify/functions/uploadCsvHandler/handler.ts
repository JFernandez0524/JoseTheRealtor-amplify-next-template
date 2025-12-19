import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { validateAddressWithGoogle } from '../../../app/utils/google.server';

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

/**
 * 🧹 CITY CLEANER
 * Normalizes "City of Orange" to "Orange" before geocoding to improve Google accuracy.
 */
const cleanCityForGeocoding = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .trim();
};

export const handler: S3Handler = async (event) => {
  if (!TABLE_NAME) {
    console.error('❌ AMPLIFY_DATA_LEAD_TABLE_NAME is not defined.');
    return;
  }

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const decodedKey = decodeURIComponent(record.s3.object.key).replace(
      /\+/g,
      ' '
    );
    let currentRow = 0,
      successCount = 0,
      ownerId = '';

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
          // 1. RAW DATA EXTRACTION
          const rawPropZip = formatZip(row['ownerZip'] || row['Zip']);
          const rawPropAddr = sanitize(
            row['ownerAddress'] || row['Property Address']
          );
          const rawPropCity = sanitize(row['ownerCity']);
          const rawPropState = sanitize(row['ownerState']);

          // 2. PRE-CLEAN CITY FOR BETTER GOOGLE MATCHING
          const cleanCity = cleanCityForGeocoding(rawPropCity);
          const fullPropString = `${rawPropAddr}, ${cleanCity}, ${rawPropState} ${rawPropZip}`;

          // 3. 🔍 VALIDATE PROPERTY ADDRESS WITH GOOGLE
          const propValidation =
            await validateAddressWithGoogle(fullPropString);

          // 🎯 EXTRACT STANDARDIZED COMPONENTS
          // We prioritize Google's results to overwrite "City of Orange" with "Orange"
          const std = propValidation?.components;
          const finalPropAddr = std?.street || rawPropAddr;
          const finalPropCity = std?.city || rawPropCity;
          const finalPropState = std?.state || rawPropState;
          const finalPropZip = std?.zip || rawPropZip;

          const standardizedAddress = propValidation
            ? {
                street: finalPropAddr,
                city: finalPropCity,
                state: finalPropState,
                zip: finalPropZip,
              }
            : null;

          // 4. COORDINATES
          const latitude = propValidation?.location?.lat
            ? String(propValidation.location.lat)
            : null;
          const longitude = propValidation?.location?.lng
            ? String(propValidation.location.lng)
            : null;

          // 5. PROBATE ADMIN / MAILING ADDRESS LOGIC
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
              const adminValidation = await validateAddressWithGoogle(
                `${rawAdminAddr}, ${sanitize(row['adminCity'])} ${rawAdminZip}`
              );
              const aStd = adminValidation?.components;
              finalMailAddr = aStd?.street || rawAdminAddr;
              finalMailCity = aStd?.city || sanitize(row['adminCity']);
              finalMailState = aStd?.state || sanitize(row['adminState']);
              finalMailZip = aStd?.zip || rawAdminZip;
              labels.push('ABSENTEE');
            }
          }

          const preSkiptracedPhone = formatPhoneNumber(row['phone']);

          // 6. 🎯 CONSTRUCT FINAL LEAD ITEM
          const leadItem = {
            id: randomUUID(),
            owner: ownerId,
            __typename: 'PropertyLead',
            type: leadType,
            ownerFirstName: formatName(
              row['ownerFirstName'] || row['First Name']
            ),
            ownerLastName: formatName(row['ownerLastName'] || row['Last Name']),

            // Standardized Property Fields
            ownerAddress: finalPropAddr,
            ownerCity: finalPropCity,
            ownerState: finalPropState,
            ownerZip: finalPropZip,
            standardizedAddress, // 🔒 Critical for Bridge API

            latitude,
            longitude,

            adminFirstName,
            adminLastName,
            adminAddress: finalMailAddr,
            adminCity: finalMailCity,
            adminState: finalMailState,
            adminZip: finalMailZip,
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
            validationStatus: propValidation ? 'VALID' : 'UNVERIFIED',
          };

          await ddbDocClient.send(
            new PutCommand({ TableName: TABLE_NAME, Item: leadItem })
          );
          successCount++;
        } catch (rowError: any) {
          console.error(`Row ${currentRow} failed:`, rowError.message);
        }
      }

      await s3.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );
    } catch (err: any) {
      console.error('❌ Critical Processing Error:', err);
    }
  }
};
