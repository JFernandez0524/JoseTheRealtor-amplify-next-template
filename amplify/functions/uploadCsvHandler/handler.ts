import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { validateAddressWithGoogle } from '../../../app/utils/google.server';
import { fetchBestZestimate } from '../shared/bridgeUtils';

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
  const autoBucketName = event.Records[0].s3.bucket.name;
  console.log(`Bucket Name: ${autoBucketName}`);

  // Get table names from environment variables (set by backend.ts)
  const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
  const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;

  if (!propertyLeadTableName || !userAccountTableName) {
    console.error('Missing table name environment variables');
    return;
  }

  for (const record of event.Records) {
    const decodedKey = decodeURIComponent(record.s3.object.key).replace(
      /\+/g,
      ' '
    );

    let currentRow = 0;
    let successCount = 0;
    let duplicateCount = 0;
    let ownerId = '';

    try {
      // 1. Extract Metadata from S3 Object
      const headObject = await s3.send(
        new HeadObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
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
        // First try to find by owner ID
        let userAccountScan = await docClient.send(new ScanCommand({
          TableName: userAccountTableName,
          FilterExpression: '#owner = :ownerId',
          ExpressionAttributeNames: {
            '#owner': 'owner'
          },
          ExpressionAttributeValues: {
            ':ownerId': ownerId
          }
        }));

        // If not found by owner ID, try to find by partial owner match (for Google login variations)
        if (!userAccountScan.Items || userAccountScan.Items.length === 0) {
          console.log(`No account found for exact owner ${ownerId}, trying partial match...`);
          
          userAccountScan = await docClient.send(new ScanCommand({
            TableName: userAccountTableName,
            FilterExpression: 'contains(#owner, :partialOwnerId)',
            ExpressionAttributeNames: {
              '#owner': 'owner'
            },
            ExpressionAttributeValues: {
              ':partialOwnerId': ownerId.split('::')[0] // Get the base user ID before ::google_
            }
          }));
        }

        if (!userAccountScan.Items || userAccountScan.Items.length === 0) {
          console.error(
            `❌ Auth Denied: User ${ownerId} has no account record. User needs to visit the app first to initialize their account.`
          );
          await s3.send(
            new DeleteObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
          );
          return;
        }
        
        console.log(`✅ Found UserAccount for owner ${ownerId}`);
      } catch (authError) {
        console.error('❌ Membership check failed:', authError);
        return;
      }

      // 3. Initiate Stream Processing
      const response = await s3.send(
        new GetObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
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
          const finalPropCounty = std?.county || null;

          const standardizedAddress = propValidation
            ? {
                street: finalPropAddr,
                city: finalPropCity,
                state: finalPropState,
                zip: finalPropZip,
                county: finalPropCounty,
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

          // --- 💾 CHECK FOR DUPLICATES BEFORE SAVING ---
          // For probate: Check by admin address (since that's who we contact)
          // For preforeclosure: Check by property address
          const duplicateCheckAddress = leadType === 'PROBATE' 
            ? `${finalMailAddr || ''} ${finalMailCity || ''} ${finalMailZip || ''}`.trim()
            : `${finalPropAddr} ${finalPropCity} ${finalPropZip}`.trim();

          if (duplicateCheckAddress) {
            const existingLeadScan = await docClient.send(new ScanCommand({
              TableName: propertyLeadTableName,
              FilterExpression: leadType === 'PROBATE' 
                ? 'contains(mailingAddress, :addr) AND mailingZip = :zip AND #owner = :owner'
                : 'contains(ownerAddress, :addr) AND ownerZip = :zip AND #owner = :owner',
              ExpressionAttributeNames: {
                '#owner': 'owner'
              },
              ExpressionAttributeValues: {
                ':addr': leadType === 'PROBATE' ? (finalMailAddr || '') : finalPropAddr,
                ':zip': leadType === 'PROBATE' ? (finalMailZip || '') : finalPropZip,
                ':owner': ownerId
              }
            }));

            if (existingLeadScan.Items && existingLeadScan.Items.length > 0) {
              console.log(`⏭️ Skipping duplicate lead: ${duplicateCheckAddress}`);
              duplicateCount++;
              continue; // Skip this lead
            }
          }
          // 🏠 Fetch Zestimate data during upload with retry logic
          let zillowData = null;
          
          // Try coordinate-based search first (more reliable)
          if (latitude && longitude) {
            try {
              const response = await bridgeClient.get('/zestimates_v2/zestimates', {
                params: {
                  near: `${longitude},${latitude}`,
                  radius: '0.05mi',
                  limit: 5  // Get multiple to find the main house
                }
              });
              
              const bundle = response.data.bundle || [];
              
              // Pick the best Zestimate: Priority 1 = No Unit Number (Main House), Priority 2 = Newest Date
              const sortedBundle = bundle.sort((a: any, b: any) => {
                const aIsMain = !a.unitNumber;
                const bIsMain = !b.unitNumber;
                if (aIsMain && !bIsMain) return -1;
                if (!aIsMain && bIsMain) return 1;
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                return dateB - dateA;
              });
              
              const z = sortedBundle[0];
              if (z) {
                zillowData = {
                  zpid: z.zpid,
                  zestimate: z.zestimate,
                  rentZestimate: z.rentalZestimate,
                  url: z.zillowUrl,
                  lastUpdated: z.timestamp,
                  address: z.address,
                  city: z.city,
                  state: z.state,
                  postalCode: z.postalCode,
                  latitude: z.Latitude,
                  longitude: z.Longitude
                };
                console.log('✅ Zestimate fetched via coords:', { zpid: zillowData.zpid, zestimate: zillowData.zestimate });
              } else {
                console.log('❌ No Zestimate data for coords:', { lat: latitude, lng: longitude });
              }
            } catch (error: any) {
              console.log('Bridge API error:', error.message);
            }
          } else {
            console.log('⚠️ No coordinates available for Zestimate lookup');
          }

          const leadItem = {
            id: randomUUID(),
            owner: ownerId,
            type: leadType,
            ownerFirstName: formatName(row['ownerFirstName'] || row['First Name']),
            ownerLastName: formatName(row['ownerLastName'] || row['Last Name']),
            ownerAddress: finalPropAddr,
            ownerCity: finalPropCity,
            ownerState: finalPropState,
            ownerZip: finalPropZip,
            ownerCounty: finalPropCounty,
            adminFirstName,
            adminLastName,
            adminAddress: finalMailAddr,
            adminCity: finalMailCity,
            adminState: finalMailState,
            adminZip: finalMailZip,
            mailingAddress: finalMailAddr || finalPropAddr,
            mailingCity: finalMailCity || finalPropCity,
            mailingState: finalMailState || finalPropState,
            mailingZip: finalMailZip || finalPropZip,
            notes: [], // Initialize empty notes array
            standardizedAddress: standardizedAddress,
            latitude,
            longitude,
            isAbsenteeOwner: labels.includes('ABSENTEE'),
            leadLabels: labels,
            phones: preSkiptracedPhone ? [preSkiptracedPhone] : [],
            skipTraceStatus: preSkiptracedPhone ? 'COMPLETED' : 'PENDING',
            ghlSyncStatus: 'PENDING',
            validationStatus: propValidation ? 'VALID' : 'INVALID',
            
            // 🏠 Zestimate and Zillow data
            estimatedValue: parseFloat(row['estimatedValue'] || row['Estimated Value']) || null,
            zestimate: zillowData?.zestimate || parseFloat(row['estimatedValue'] || row['Estimated Value']) || null,
            zestimateDate: zillowData ? new Date().toISOString() : null,
            zestimateSource: zillowData ? 'ZILLOW' : (row['estimatedValue'] ? 'CSV' : null),
            zillowZpid: zillowData?.zpid || null,
            zillowUrl: zillowData?.url || null,
            rentZestimate: zillowData?.rentZestimate || null,
            priceHistory: null,
            taxHistory: null,
            homeDetails: null,
            neighborhoodData: null,
            comparableProperties: null,
            zillowLastUpdated: zillowData ? new Date().toISOString() : null,
            
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await docClient.send(new PutCommand({
            TableName: propertyLeadTableName,
            Item: leadItem
          }));

          successCount++;
        } catch (rowError: any) {
          console.error(`❌ Row ${currentRow} failed:`, rowError.message);
        }
      }

      // 4. Cleanup S3 File
      await s3.send(
        new DeleteObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
      );
      console.log(
        `✅ Finished: Processed ${successCount} leads, skipped ${duplicateCount} duplicates for ${ownerId}`
      );
    } catch (err: any) {
      console.error('❌ Critical Processing Error:', err);
    }
  }
};
