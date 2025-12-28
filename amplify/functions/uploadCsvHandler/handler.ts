import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

// --- AMPLIFY GEN 2 IMPORTS ---
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { validateAddressWithGoogle } from '../../../app/utils/google.server';

/**
 * 🚀 INITIALIZE AMPLIFY CLIENT
 * Using 'env as any' to bypass temporary local environment type mismatches.
 */
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
  process.env as any
);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const s3 = new S3Client({});

// 🛡️ Define the strict type based on your schema
// 🛡️ This extracts the exact input type for the create method
type LeadCreateInput = Parameters<typeof client.models.PropertyLead.create>[0];

// ---------------------------------------------------------
// 🛠️ FORMATTING HELPERS
// ---------------------------------------------------------

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

const cleanCityForGeocoding = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .trim();
};

// ---------------------------------------------------------
// 🚀 MAIN S3 HANDLER
// ---------------------------------------------------------

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const decodedKey = decodeURIComponent(record.s3.object.key).replace(
      /\+/g,
      ' '
    );

    let currentRow = 0;
    let successCount = 0;
    let ownerId = '';

    try {
      // 1. Extract Metadata from S3 Object
      const headObject = await s3.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );

      ownerId = headObject.Metadata?.['owner_sub'] || '';
      const leadType = (
        headObject.Metadata?.['leadtype'] || 'PREFORECLOSURE'
      ).toUpperCase();

      if (!ownerId) {
        console.error(
          `❌ No owner_sub found in metadata for key: ${decodedKey}`
        );
        return;
      }

      // 🛡️ 2. MEMBERSHIP PROTECTION GUARD
      try {
        const { data: userAccounts } = await client.models.UserAccount.list({
          filter: {
            owner: {
              eq: ownerId,
            },
          },
        });

        if (!userAccounts) {
          console.error(
            `❌ Auth Denied: User ${ownerId} has no account record.`
          );
          await s3.send(
            new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
          );
          return;
        }
      } catch (authError) {
        console.error('❌ Membership check failed:', authError);
        return;
      }

      // 3. Initiate Stream Processing
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
          // --- RAW DATA EXTRACTION ---
          const rawPropZip = formatZip(row['ownerZip'] || row['Zip']);
          const rawPropAddr = sanitize(
            row['ownerAddress'] || row['Property Address']
          );
          const rawPropCity = sanitize(row['ownerCity']);
          const rawPropState = sanitize(row['ownerState']);

          const cleanCity = cleanCityForGeocoding(rawPropCity);
          const fullPropString = `${rawPropAddr}, ${cleanCity}, ${rawPropState} ${rawPropZip}`;

          // --- 🔍 VALIDATE PROPERTY ADDRESS WITH GOOGLE ---
          const propValidation =
            await validateAddressWithGoogle(fullPropString);

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

          // 🔢 CONVERT TO NUMBERS: Satisfies a.float() type requirement
          const latitude = propValidation?.location?.lat
            ? Number(propValidation.location.lat)
            : null;
          const longitude = propValidation?.location?.lng
            ? Number(propValidation.location.lng)
            : null;

          // --- PROBATE ADMIN LOGIC ---
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

          // --- 🎯 CONSTRUCT LEAD ITEM (Mapped to LeadItem Type) ---
          // 🎯 CONSTRUCT LEAD ITEM
          const leadItem: LeadCreateInput = {
            id: randomUUID(),
            owner: ownerId,
            type: leadType,
            ownerFirstName: formatName(
              row['ownerFirstName'] || row['First Name']
            ),
            ownerLastName: formatName(row['ownerLastName'] || row['Last Name']),
            ownerAddress: finalPropAddr,
            ownerCity: finalPropCity,
            ownerState: finalPropState,
            ownerZip: finalPropZip,
            standardizedAddress: standardizedAddress as any, // Cast JSON if needed
            latitude, // Must be number | null
            longitude, // Must be number | null
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
            phones: preSkiptracedPhone ? [preSkiptracedPhone] : [],
            skipTraceStatus: preSkiptracedPhone ? 'COMPLETED' : 'PENDING',
            ghlSyncStatus: 'PENDING',
            validationStatus: (propValidation ? 'VALID' : 'UNVERIFIED') as any,
          };

          // --- 💾 SAVE TO DYNAMODB ---
          await client.models.PropertyLead.create(leadItem);

          successCount++;
        } catch (rowError: any) {
          console.error(`❌ Row ${currentRow} failed:`, rowError.message);
        }
      }

      // 4. Cleanup S3 File
      await s3.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: decodedKey })
      );
      console.log(
        `✅ Finished: Processed ${successCount} leads for ${ownerId}`
      );
    } catch (err: any) {
      console.error('❌ Critical Processing Error:', err);
    }
  }
};
