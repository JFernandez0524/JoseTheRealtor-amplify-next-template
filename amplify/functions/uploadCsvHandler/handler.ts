import { S3Handler } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { validateAddressWithGoogle, toTitleCase } from '../../../app/utils/google.server';
import { fetchBestZestimate } from '../../../app/utils/bridge.server';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true }
});

console.log('🔧 [CSV_UPLOAD] Lambda initialized');
console.log('🔧 [CSV_UPLOAD] Environment:', {
  hasPropertyLeadTable: !!process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME,
  hasUserAccountTable: !!process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME,
  hasGoogleApiKey: !!process.env.GOOGLE_MAPS_API_KEY,
  hasBridgeApiKey: !!process.env.BRIDGE_API_KEY,
  region: process.env.AWS_REGION
});

// ---------------------------------------------------------
// 🚦 RATE LIMITING
// ---------------------------------------------------------
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const BRIDGE_API_DELAY_MS = 200; // 334/min = ~180ms, use 200ms to be safe
const GOOGLE_API_DELAY_MS = 60;  // ~16 QPS — well under Google's 100 QPS limit
const MAX_UPLOAD_ROWS = 500;     // hard cap: prevents Lambda timeout and API quota exhaustion
const MAX_DUPLICATE_STORE = 100; // max duplicate entries to store in DynamoDB (400KB item limit)

// ---------------------------------------------------------
// 🛠️ FORMATTING HELPERS
// ---------------------------------------------------------

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

const sanitize = (val: any, maxLen = 255): string => {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/<[^>]*>?/gm, '') // strip HTML/script tags
    .replace(/\0/g, '')         // strip null bytes
    .substring(0, maxLen);
};

function detectEmailsInRow(row: Record<string, any>, rowNum: number): { rowNum: number; field: string; value: string } | null {
  for (const [field, raw] of Object.entries(row)) {
    if (typeof raw === 'string' && EMAIL_PATTERN.test(raw.trim())) {
      return { rowNum, field, value: raw.trim().substring(0, 80) };
    }
  }
  return null;
}

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

const parseOwnershipName = (ownership: string): { firstName: string; lastName: string } => {
  if (!ownership) return { firstName: '', lastName: '' };
  
  // Remove common suffixes
  const cleaned = ownership
    .replace(/\b(ESTATE|TRUST|TRUSTEE|EXEC|EXECUTOR|ETAL|ET AL|C\/O|%)\b/gi, '')
    .trim();
  
  if (!cleaned) return { firstName: '', lastName: '' };
  
  // Check if there are multiple people (contains &)
  if (cleaned.includes('&')) {
    const people = cleaned.split('&').map(p => p.trim());
    const firstNames: string[] = [];
    const lastNames: string[] = [];
    
    for (const person of people) {
      if (person.includes(',')) {
        // "LAST, FIRST" format
        const parts = person.split(',').map(s => s.trim());
        lastNames.push(formatName(parts[0]));
        firstNames.push(formatName(parts.slice(1).join(' ')));
      } else {
        // "FIRST LAST" format
        const words = person.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 1) {
          lastNames.push(formatName(words[0]));
        } else {
          const suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V'];
          const lastWord = words[words.length - 1].toUpperCase().replace(/\./g, '');
          const lastNameIndex = suffixes.includes(lastWord) ? words.length - 2 : words.length - 1;
          
          firstNames.push(words.slice(0, lastNameIndex).map(w => formatName(w)).join(' '));
          lastNames.push(formatName(words[lastNameIndex]));
        }
      }
    }
    
    return {
      firstName: firstNames.filter(f => f).join(' & '),
      lastName: lastNames.filter(l => l).join(' & '),
    };
  }
  
  // Single person - check if format is "LAST, FIRST"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(s => s.trim());
    const lastPart = parts[0];
    const firstPart = parts.slice(1).join(' ').trim();
    
    return {
      firstName: formatName(firstPart || ''),
      lastName: formatName(lastPart || ''),
    };
  }
  
  // Single person - "FIRST MIDDLE LAST" format
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: '', lastName: formatName(words[0]) };
  
  const lastWord = words[words.length - 1].toUpperCase().replace(/\./g, '');
  const suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V', 'ESQ', 'MD', 'PHD', 'DDS'];
  
  let lastNameIndex = words.length - 1;
  if (suffixes.includes(lastWord)) {
    lastNameIndex = words.length - 2;
  }
  
  if (lastNameIndex <= 0) {
    return { firstName: '', lastName: formatName(words[0]) };
  }
  
  const firstName = words.slice(0, lastNameIndex).map(w => formatName(w)).join(' ');
  const lastName = formatName(words[lastNameIndex]);
  
  return { firstName, lastName };
};

const cleanCityForGeocoding = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .trim();
};

// ---------------------------------------------------------
// 🔍 DUPLICATE DETECTION HELPERS
// ---------------------------------------------------------

function makeAddressKey(addr: string | null | undefined, zip: string | null | undefined): string | null {
  const cleanAddr = (addr || '').toLowerCase().trim();
  const cleanZip = (zip || '').replace(/\D/g, '').slice(0, 5);
  if (!cleanAddr || !cleanZip) return null;
  return `${cleanAddr}|${cleanZip}`;
}

// Single paginated scan instead of one scan per row — dramatically reduces DynamoDB cost and time
async function preloadExistingLeadKeys(
  tableName: string,
  ownerId: string
): Promise<{ keys: Set<string>; keyToId: Map<string, string> }> {
  const keys = new Set<string>();
  const keyToId = new Map<string, string>();
  let lastKey: Record<string, any> | undefined;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#owner = :ownerId',
      ExpressionAttributeNames: {
        '#owner': 'owner',
        '#oa': 'ownerAddress',
        '#oz': 'ownerZip',
        '#ma': 'mailingAddress',
        '#mz': 'mailingZip',
      },
      ExpressionAttributeValues: { ':ownerId': ownerId },
      ProjectionExpression: 'id, #oa, #oz, #ma, #mz',
      ExclusiveStartKey: lastKey,
    }));
    for (const lead of Items || []) {
      const prefoKey = makeAddressKey(lead.ownerAddress, lead.ownerZip);
      if (prefoKey) { keys.add(prefoKey); keyToId.set(prefoKey, lead.id); }
      const probateKey = makeAddressKey(lead.mailingAddress, lead.mailingZip);
      if (probateKey && probateKey !== prefoKey) { keys.add(probateKey); keyToId.set(probateKey, lead.id); }
    }
    lastKey = LastEvaluatedKey;
  } while (lastKey);
  return { keys, keyToId };
}

// ---------------------------------------------------------
// 🚀 MAIN S3 HANDLER
// ---------------------------------------------------------

export const handler: S3Handler = async (event) => {
  const autoBucketName = event.Records[0].s3.bucket.name;
  console.log(`Bucket Name: ${autoBucketName}`);

  // Get table names from environment variables (set by backend.ts)
  const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
  const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;
  const csvUploadJobTableName = process.env.AMPLIFY_DATA_CsvUploadJob_TABLE_NAME;

  if (!propertyLeadTableName || !userAccountTableName || !csvUploadJobTableName) {
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
    const duplicateLeads: any[] = [];
    let ownerId = '';
    let jobId = '';

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

      // Find existing job record (created by frontend)
      const fileName = decodedKey.split('/').pop() || 'unknown.csv';
      const jobScan = await docClient.send(new ScanCommand({
        TableName: csvUploadJobTableName,
        FilterExpression: 'userId = :userId AND fileName = :fileName AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':userId': ownerId,
          ':fileName': fileName,
          ':status': 'PENDING'
        }
      }));

      if (!jobScan.Items || jobScan.Items.length === 0) {
        console.error(`❌ No pending job found for file: ${fileName}`);
        return;
      }

      jobId = jobScan.Items[0].id as string;
      console.log(`📝 Found job record: ${jobId}`);

      // Update job status to PROCESSING
      await docClient.send(new UpdateCommand({
        TableName: csvUploadJobTableName,
        Key: { id: jobId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updated',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'PROCESSING',
          ':updated': new Date().toISOString(),
        }
      }));

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

      // 3. Count total rows first
      const countResponse = await s3.send(
        new GetObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
      );
      const countStream = countResponse.Body as Readable;
      const countParser = countStream.pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true, bom: true })
      );
      
      let totalRows = 0;
      const emailViolations: { rowNum: number; field: string; value: string }[] = [];
      for await (const row of countParser) {
        totalRows++;
        const violation = detectEmailsInRow(row as Record<string, any>, totalRows);
        if (violation) emailViolations.push(violation);
      }

      console.log(`📊 Total rows to process: ${totalRows}`);

      if (emailViolations.length > 0) {
        const lines = emailViolations.slice(0, 5).map(v => `Row ${v.rowNum} (${v.field}): "${v.value}"`);
        const extra = emailViolations.length > 5 ? ` …and ${emailViolations.length - 5} more row(s)` : '';
        const errorMessage =
          `Upload blocked: email addresses are not allowed in CSV field values. ` +
          `Please remove all emails from the file and re-upload.\n\n` +
          `Found in:\n${lines.join('\n')}${extra}`;
        await docClient.send(new UpdateCommand({
          TableName: csvUploadJobTableName,
          Key: { id: jobId },
          UpdateExpression: 'SET #status = :status, errorMessage = :error, completedAt = :completed, updatedAt = :updated',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'FAILED',
            ':error': errorMessage,
            ':completed': new Date().toISOString(),
            ':updated': new Date().toISOString(),
          },
        }));
        console.log(`❌ Upload rejected: email addresses found in ${emailViolations.length} row(s)`);
        return;
      }
      
      // Update job with total rows
      await docClient.send(new UpdateCommand({
        TableName: csvUploadJobTableName,
        Key: { id: jobId },
        UpdateExpression: 'SET totalRows = :total, updatedAt = :updated',
        ExpressionAttributeValues: {
          ':total': totalRows,
          ':updated': new Date().toISOString(),
        }
      }));

      // 🚦 Enforce row limit — prevents Lambda timeout and API quota exhaustion
      if (totalRows > MAX_UPLOAD_ROWS) {
        await docClient.send(new UpdateCommand({
          TableName: csvUploadJobTableName,
          Key: { id: jobId },
          UpdateExpression: 'SET #status = :status, errorMessage = :error, completedAt = :completed, updatedAt = :updated',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'FAILED',
            ':error': `File has ${totalRows} rows — the maximum is ${MAX_UPLOAD_ROWS} per upload. Please split your file into smaller batches.`,
            ':completed': new Date().toISOString(),
            ':updated': new Date().toISOString(),
          }
        }));
        console.log(`❌ Upload rejected: ${totalRows} rows exceeds ${MAX_UPLOAD_ROWS} row limit`);
        return;
      }

      // Pre-load all existing lead addresses for O(1) duplicate detection (replaces per-row table scan)
      console.log('🔍 Pre-loading existing lead addresses for duplicate detection...');
      const { keys: existingAddressKeys, keyToId: existingKeyToId } =
        await preloadExistingLeadKeys(propertyLeadTableName!, ownerId);
      console.log(`📋 ${existingAddressKeys.size} existing address keys loaded`);

      // 4. Initiate Stream Processing
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
          await delay(GOOGLE_API_DELAY_MS); // respect Google Address Validation QPS limit
          const propValidation =
            await validateAddressWithGoogle(fullPropString);

          const std = propValidation?.components;
          // Keep original CSV address for Zillow links, use standardized for geocoding
          const finalPropAddr = toTitleCase(rawPropAddr); // Apply Title Case to CSV address
          const finalPropCity = toTitleCase(rawPropCity); // Apply Title Case to CSV city
          const finalPropState = std?.state || rawPropState; // Use standardized state (NJ vs New Jersey)
          // Strip +4 from zip codes (keep only 5 digits)
          const finalPropZip = (std?.zip || rawPropZip)?.split('-')[0];
          const finalPropCounty = std?.county || null;

          const standardizedAddress = propValidation
            ? {
                street: std?.street || rawPropAddr, // Keep Google's standardized version for geocoding
                city: std?.city || rawPropCity,
                state: finalPropState,
                zip: finalPropZip,
                county: finalPropCounty,
              }
            : null;

          // 🔢 CONVERT TO NUMBERS: Satisfies a.float() type requirement
          const latitude = propValidation?.location?.latitude
            ? Number(propValidation.location.latitude)
            : null;
          const longitude = propValidation?.location?.longitude
            ? Number(propValidation.location.longitude)
            : null;

          // --- PROBATE ADMIN LOGIC ---
          let finalMailAddr = null,
            finalMailCity = null,
            finalMailState = null,
            finalMailZip = null;
          let adminFirstName = null,
            adminLastName = null,
            adminStandardizedAddress = null;
          let ownerFirstName = formatName(row['ownerFirstName'] || row['First Name']);
          let ownerLastName = formatName(row['ownerLastName'] || row['Last Name']);
          const labels: string[] = [leadType];

          if (leadType === 'PROBATE') {
            // Parse ownership name if provided, otherwise use individual fields
            if (row['OWNERSHIP'] || row['ownership']) {
              const parsed = parseOwnershipName(row['OWNERSHIP'] || row['ownership']);
              ownerFirstName = parsed.firstName;
              ownerLastName = parsed.lastName;
            }
            adminFirstName = formatName(row['adminFirstName']);
            adminLastName = formatName(row['adminLastName']);
            const rawAdminZip = formatZip(row['adminZip']);
            const rawAdminAddr = sanitize(
              row['adminAddress'] || row['Mailing Address']
            );

            if (rawAdminAddr) {
              await delay(GOOGLE_API_DELAY_MS); // respect Google Address Validation QPS limit
              const adminValidation = await validateAddressWithGoogle(
                `${rawAdminAddr}, ${sanitize(row['adminCity'])} ${rawAdminZip}`
              );
              const aStd = adminValidation?.components;
              finalMailAddr = toTitleCase(aStd?.street || rawAdminAddr);
              finalMailCity = toTitleCase(aStd?.city || sanitize(row['adminCity']));
              finalMailState = aStd?.state || sanitize(row['adminState']);
              // Strip +4 from admin zip
              finalMailZip = (aStd?.zip || rawAdminZip)?.split('-')[0];
              
              // Store admin standardized address
              if (adminValidation) {
                adminStandardizedAddress = {
                  street: { S: finalMailAddr },
                  city: { S: finalMailCity },
                  state: { S: finalMailState },
                  zip: { S: finalMailZip },
                  county: { S: aStd?.county || '' },
                };
              }
              
              labels.push('ABSENTEE');
            }
          }

          const preSkiptracedPhone = formatPhoneNumber(row['phone']);

          // --- 💾 CHECK FOR DUPLICATES BEFORE SAVING ---
          // O(1) lookup against the pre-loaded Set — replaces a full table scan per row
          const dupKey = leadType === 'PROBATE'
            ? makeAddressKey(finalMailAddr, finalMailZip)
            : makeAddressKey(finalPropAddr, finalPropZip);
          const duplicateCheckAddress = leadType === 'PROBATE'
            ? `${finalMailAddr || ''} ${finalMailCity || ''} ${finalMailZip || ''}`.trim()
            : `${finalPropAddr} ${finalPropCity} ${finalPropZip}`.trim();

          if (dupKey && existingAddressKeys.has(dupKey)) {
            console.log(`⏭️ Skipping duplicate lead for user ${ownerId}: ${duplicateCheckAddress}`);

            if (duplicateLeads.length < MAX_DUPLICATE_STORE) {
              duplicateLeads.push({
                csvData: {
                  ownerName: `${ownerFirstName || ''} ${ownerLastName || ''}`.trim(),
                  address: finalPropAddr,
                  city: finalPropCity,
                  state: finalPropState,
                  zip: finalPropZip,
                },
                existingLeadId: existingKeyToId.get(dupKey) || null,
                existingLeadData: null,
              });
            }

            duplicateCount++;

            if (currentRow % 25 === 0) {
              await docClient.send(new UpdateCommand({
                TableName: csvUploadJobTableName,
                Key: { id: jobId },
                UpdateExpression: 'SET processedRows = :processed, successCount = :success, duplicateCount = :duplicate, duplicateLeads = :duplicates, updatedAt = :updated',
                ExpressionAttributeValues: {
                  ':processed': currentRow,
                  ':success': successCount,
                  ':duplicate': duplicateCount,
                  ':duplicates': duplicateLeads,
                  ':updated': new Date().toISOString(),
                }
              }));
            }

            continue; // Skip this lead
          }
          // 🏠 Fetch Zestimate data during upload
          let zillowData = null;
          
          try {
            // 🚦 Rate limit: Wait before API call
            await delay(BRIDGE_API_DELAY_MS);
            
            // Use standardized address from Google (USPS CASS) for better matching
            const zestimateStreet = standardizedAddress?.street || finalPropAddr;
            const zestimateCity = standardizedAddress?.city || finalPropCity;
            // Strip +4 from zip code (Bridge API doesn't like it)
            const zestimateZip = (standardizedAddress?.zip || finalPropZip)?.split('-')[0];
            
            zillowData = await fetchBestZestimate({
              lat: latitude || undefined,
              lng: longitude || undefined,
              street: zestimateStreet,
              city: zestimateCity,
              state: finalPropState,
              zip: zestimateZip,
            });
            
            if (zillowData) {
              console.log('✅ Zestimate fetched:', { zpid: zillowData.zpid, zestimate: zillowData.zestimate });
            } else {
              console.log('❌ No Zestimate data for address:', { address: zestimateStreet, city: zestimateCity });
            }
          } catch (error: any) {
            console.log('Bridge API error:', error.message);
          }

          const leadItem = {
            id: randomUUID(),
            owner: ownerId,
            type: leadType,
            ownerFirstName,
            ownerLastName,
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
            adminStandardizedAddress,
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
            skipTraceCompletedAt: preSkiptracedPhone ? new Date().toISOString() : null,
            skipTraceHistory: preSkiptracedPhone ? [{
              timestamp: new Date().toISOString(),
              status: 'COMPLETED',
              reason: 'Phone number provided in CSV upload — no skip trace required.',
              phonesFound: 1,
              emailsFound: 0,
              batchRequestId: null,
              responseTime: null,
            }] : [],
            ghlSyncStatus: 'PENDING',
            listingStatus: 'off_market', // Default to off_market for new leads
            uploadSource: 'csv_upload',
            validationStatus: propValidation ? 'VALID' : 'INVALID',
            
            // 🏠 Zestimate and Zillow data
            estimatedValue: parseFloat(row['estimatedValue'] || row['Estimated Value']) || null,
            zestimate: zillowData?.zestimate || parseFloat(row['estimatedValue'] || row['Estimated Value']) || null,
            zestimateDate: zillowData ? new Date().toISOString() : null,
            zestimateSource: zillowData ? 'ZILLOW' : (row['estimatedValue'] ? 'CSV' : null),
            zillowZpid: zillowData?.zpid || null,
            zillowUrl: zillowData?.url || null,
            zillowAddress: zillowData?.address || null,
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

          // Register new lead in the duplicate set so intra-file duplicates are caught
          if (dupKey) existingAddressKeys.add(dupKey);

          successCount++;

          if (currentRow % 25 === 0) {
            await docClient.send(new UpdateCommand({
              TableName: csvUploadJobTableName,
              Key: { id: jobId },
              UpdateExpression: 'SET processedRows = :processed, successCount = :success, duplicateCount = :duplicate, duplicateLeads = :duplicates, updatedAt = :updated',
              ExpressionAttributeValues: {
                ':processed': currentRow,
                ':success': successCount,
                ':duplicate': duplicateCount,
                ':duplicates': duplicateLeads,
                ':updated': new Date().toISOString(),
              }
            }));
          }
        } catch (rowError: any) {
          console.error(`❌ Row ${currentRow} failed:`, rowError.message);
        }
      }

      // 5. Update job record as completed
      await docClient.send(new UpdateCommand({
        TableName: csvUploadJobTableName,
        Key: { id: jobId },
        UpdateExpression: 'SET #status = :status, successCount = :success, duplicateCount = :duplicate, duplicateLeads = :duplicates, errorCount = :errors, processedRows = :processed, completedAt = :completed, updatedAt = :updated',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'COMPLETED',
          ':success': successCount,
          ':duplicate': duplicateCount,
          ':duplicates': duplicateLeads,
          ':errors': currentRow - successCount - duplicateCount,
          ':processed': currentRow,
          ':completed': new Date().toISOString(),
          ':updated': new Date().toISOString(),
        }
      }));
      console.log(`✅ Job ${jobId} completed`);

      // 6. Cleanup S3 File
      await s3.send(
        new DeleteObjectCommand({ Bucket: autoBucketName, Key: decodedKey })
      );
      console.log(
        `✅ Finished: Processed ${successCount} leads, skipped ${duplicateCount} duplicates for ${ownerId}`
      );
    } catch (err: any) {
      console.error('❌ Critical Processing Error:', err);
      
      // Update job as failed
      if (jobId && csvUploadJobTableName) {
        await docClient.send(new UpdateCommand({
          TableName: csvUploadJobTableName,
          Key: { id: jobId },
          UpdateExpression: 'SET #status = :status, errorMessage = :error, completedAt = :completed, updatedAt = :updated',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'FAILED',
            ':error': err.message || 'Unknown error',
            ':completed': new Date().toISOString(),
            ':updated': new Date().toISOString(),
          }
        }));
      }
    }
  }
};
