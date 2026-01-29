import axios, { isAxiosError } from 'axios';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;
const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;

console.log('🔧 [SKIP_TRACE] Lambda initialized');
console.log('🔧 [SKIP_TRACE] Environment:', {
  hasApiKey: !!BATCH_DATA_SERVER_TOKEN,
  hasPropertyLeadTable: !!propertyLeadTableName,
  hasUserAccountTable: !!userAccountTableName,
  region: process.env.AWS_REGION
});

// ---------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------
type Handler = (event: { arguments: { leadIds: string[] }; identity: { sub: string } }) => Promise<any>;

type MailingAddressData = {
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
};

type BatchDataResult = {
  status: 'SUCCESS' | 'NO_MATCH' | 'INVALID_GEO' | 'ERROR' | 'NO_QUALITY_CONTACTS';
  foundPhones: string[];
  foundEmails: string[];
  mailingData?: MailingAddressData | null;
  rawPersonData?: any;
  firstName?: string | null;
  lastName?: string | null;
};

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

function cleanName(name: { first?: string | null; last?: string | null }) {
  const cleaned: any = {};
  if (name.first) cleaned.first = name.first;
  if (name.last) cleaned.last = name.last;
  return cleaned;
}

async function callBatchDataBulk(leads: any[]): Promise<Map<string, BatchDataResult>> {
  if (!BATCH_DATA_SERVER_TOKEN) {
    console.error('❌ BATCH_DATA_SERVER_TOKEN is not set');
    throw new Error('Missing BatchData API Key');
  }

  console.log(`📞 Calling BatchData API for ${leads.length} leads`);

  const requests = leads.map(lead => {
    let targetAddress = {
      street: lead.ownerAddress?.trim() || '',
      city: lead.ownerCity?.trim() || '',
      state: lead.ownerState?.trim().toUpperCase() || '',
      zip: lead.ownerZip?.trim() || '',
    };

    // Use standardized address if available
    if (lead.standardizedAddress?.street?.S) {
      targetAddress = {
        street: lead.standardizedAddress.street.S,
        city: lead.standardizedAddress.city.S,
        state: lead.standardizedAddress.state.S,
        zip: lead.standardizedAddress.zip.S,
      };
    }

    if (lead.type?.toUpperCase() === 'PROBATE') {
      targetAddress = {
        street: lead.adminAddress?.trim() || '',
        city: lead.adminCity?.trim() || '',
        state: lead.adminState?.trim().toUpperCase() || '',
        zip: lead.adminZip?.trim() || '',
      };

      // Use admin standardized address if available
      if (lead.adminStandardizedAddress?.street?.S) {
        targetAddress = {
          street: lead.adminStandardizedAddress.street.S,
          city: lead.adminStandardizedAddress.city.S,
          state: lead.adminStandardizedAddress.state.S,
          zip: lead.adminStandardizedAddress.zip.S,
        };
      }
    }

    return {
      requestId: lead.id,
      propertyAddress: targetAddress,
      options: {
        prioritizeMobilePhones: true,
        includeTCPABlacklistedPhones: false,
      },
    };
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Sending request to BatchData (attempt ${attempt + 1}/${MAX_RETRIES})`);
      console.log(`Request payload:`, JSON.stringify({ requests: requests.slice(0, 2) }, null, 2)); // Log first 2 for debugging
      
      const res = await axios.post(
        'https://api.batchdata.com/api/v1/property/skip-trace',
        { requests },
        {
          headers: {
            Authorization: `Bearer ${BATCH_DATA_SERVER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ BatchData API response received`);
      console.log(`Response status: ${res.status}`);
      console.log(`Response data:`, JSON.stringify(res.data, null, 2));
      console.log(`Persons count: ${res.data?.results?.persons?.length || 0}`);

      const resultMap = new Map<string, BatchDataResult>();
      const personsArray = res.data?.results?.persons || [];

      for (const result of personsArray) {
        const leadId = result.request?.requestId;
        if (!leadId) continue;
        
        if (!result.meta?.matched) {
          resultMap.set(leadId, {
            status: 'NO_MATCH',
            foundPhones: [],
            foundEmails: [],
            mailingData: null,
          });
          continue;
        }

        const person = result;
        const foundPhones: string[] = [];
        const foundEmails: string[] = [];
        let mailingData = null;

        if (person.mailingAddress?.street) {
          mailingData = {
            mailingAddress: person.mailingAddress.street,
            mailingCity: person.mailingAddress.city,
            mailingState: person.mailingAddress.state,
            mailingZip: person.mailingAddress.zip,
          };
        }

        person.phoneNumbers?.forEach((p: any) => {
          if (
            p.type === 'Mobile' &&
            (parseFloat(p.score) || 0) >= 90 &&
            !p.dnc &&
            p.number
          ) {
            foundPhones.push(p.number);
          }
        });

        person.emails?.forEach((e: any) => {
          if (e.tested && e.email) foundEmails.push(e.email);
        });

        const status = foundPhones.length > 0 || foundEmails.length > 0 ? 'SUCCESS' : 'NO_QUALITY_CONTACTS';
        resultMap.set(leadId, { 
          status, 
          foundPhones, 
          foundEmails, 
          mailingData,
          rawPersonData: person,
          firstName: person.name?.first || null,
          lastName: person.name?.last || null,
        });
      }

      return resultMap;
    } catch (error: any) {
      console.error(`❌ BatchData API error (attempt ${attempt + 1}):`, error.message);
      console.error(`Error details:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      if (
        isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < MAX_RETRIES - 1
      ) {
        console.log(`⏳ Rate limited, retrying in ${RETRY_DELAY_MS * Math.pow(2, attempt)}ms...`);
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
        continue;
      }
      
      // Don't catch and return empty - let it fail on last attempt
      if (attempt === MAX_RETRIES - 1) {
        console.error('❌ All retry attempts failed');
        throw error;
      }
    }
  }
  
  const errorMap = new Map<string, BatchDataResult>();
  leads.forEach(lead => {
    errorMap.set(lead.id, {
      status: 'ERROR',
      foundPhones: [],
      foundEmails: [],
      mailingData: null,
    });
  });
  return errorMap;
}

// ---------------------------------------------------------
// Main Handler
// ---------------------------------------------------------

export const handler: Handler = async (event) => {
  console.log('🚀 Skip trace handler started');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { leadIds } = event.arguments;
  const identity = event.identity;

  console.log(`📋 Lead IDs received: ${leadIds?.length || 0}`);

  let ownerId: string | undefined;
  let groups: string[] = [];

  // 🛡️ 1. Extract Identity Safely
  if (identity && 'sub' in identity) {
    ownerId = identity.sub;
    groups = (identity as any).claims?.['cognito:groups'] || [];
  }

  console.log(`👤 Owner ID: ${ownerId}`);
  console.log(`👥 Groups: ${groups.join(', ')}`);

  if (!ownerId || !leadIds?.length) {
    console.error('❌ Missing user identity or lead data');
    throw new Error('Unauthorized: Missing user identity or lead data.');
  }

  // 🛡️ 2. Tier Authorization Check
  const isAuthorized = groups.some((g: string) =>
    ['PRO', 'AI_PLAN', 'ADMINS'].includes(g)
  );

  console.log(`🔐 Authorization check: ${isAuthorized}`);

  if (!isAuthorized) {
    console.error('❌ User not authorized');
    throw new Error(
      'Forbidden: A paid membership is required to use this feature.'
    );
  }

  try {
    console.log('💰 Checking user credits...');
    
    // 💰 3. Wallet Check using ScanCommand with Filter
    const { Items: accounts } = await docClient.send(new ScanCommand({
      TableName: userAccountTableName,
      FilterExpression: '#owner = :ownerId',
      ExpressionAttributeNames: {
        '#owner': 'owner'
      },
      ExpressionAttributeValues: {
        ':ownerId': ownerId
      }
    }));
    
    const userAccount = accounts?.[0];
    const isOwner = ownerId === '44d8f4c8-10c1-7038-744b-271103170819'; // Jose - unlimited credits
    const isAdmin = groups.includes('ADMINS');
    const isPro = groups.includes('PRO');

    console.log(`💳 User account found: ${!!userAccount}`);
    console.log(`💰 Credits: ${userAccount?.credits || 0}`);
    console.log(`👑 Is Owner: ${isOwner}`);
    console.log(`🔧 Is Admin: ${isAdmin}`);

    // All users need credits for skip tracing, except OWNER
    if (!isOwner) {
      // Check credit expiration for FREE users only
      if (!isPro && userAccount?.creditsExpiresAt) {
        const expirationDate = new Date(userAccount.creditsExpiresAt);
        const now = new Date();
        if (now > expirationDate) {
          console.error('❌ Credits expired');
          throw new Error('Credits have expired. Please upgrade to PRO or purchase more credits.');
        }
      }

      if (!userAccount || (userAccount.credits || 0) < leadIds.length) {
        console.error(`❌ Insufficient credits: need ${leadIds.length}, have ${userAccount?.credits || 0}`);
        throw new Error(
          `Insufficient Credits: Need ${leadIds.length}, have ${userAccount?.credits || 0}. Purchase skip tracing credits to continue.`
        );
      }
    }

    console.log('✅ Credit check passed');
    console.log('📥 Fetching leads...');

    // 🛡️ 4. Fetch all leads upfront
    const leads = [];
    for (const leadId of leadIds) {
      if (!leadId) continue;
      const { Item: lead } = await docClient.send(new GetCommand({
        TableName: propertyLeadTableName,
        Key: { id: leadId }
      }));
      if (lead && (lead.owner ?? '') === ownerId) {
        // Validate probate leads have admin info
        if (lead.type?.toUpperCase() === 'PROBATE' && (!lead.adminFirstName || !lead.adminLastName || !lead.adminAddress)) {
          console.warn(`⚠️ Invalid probate lead ${leadId} - missing admin info`);
          // Mark lead with validation error instead of throwing
          await docClient.send(new UpdateCommand({
            TableName: propertyLeadTableName,
            Key: { id: leadId },
            UpdateExpression: 'SET validationStatus = :status, validationErrors = :errors',
            ExpressionAttributeValues: {
              ':status': 'INVALID',
              ':errors': ['Missing required admin information (name and address) for probate lead']
            }
          }));
          continue; // Skip this lead
        }
        leads.push(lead);
      }
    }

    console.log(`✅ Fetched ${leads.length} valid leads`);

    // Filter out SOLD/SKIP leads
    const leadsToProcess = leads.filter(lead => 
      lead.manualStatus !== 'SOLD' && lead.manualStatus !== 'SKIP'
    );

    const skippedLeads = leads.filter(lead => 
      lead.manualStatus === 'SOLD' || lead.manualStatus === 'SKIP'
    );

    const results: any[] = skippedLeads.map(lead => ({
      id: lead.id,
      status: 'SKIPPED',
      reason: `Marked as ${lead.manualStatus}`
    }));

    if (leadsToProcess.length === 0) {
      console.log('⏭️ No leads to process, returning early');
      return results;
    }

    console.log(`🔄 Processing ${leadsToProcess.length} leads with BatchData...`);

    // 5. Call BatchData once with all leads
    const enrichmentMap = await callBatchDataBulk(leadsToProcess);

    console.log(`✅ BatchData processing complete, updating ${leadsToProcess.length} leads...`);

    // 6. Update all leads in parallel
    const updatePromises = leadsToProcess.map(async (lead) => {
      const enrichedData = enrichmentMap.get(lead.id);
      if (!enrichedData || (enrichedData.status !== 'SUCCESS' && enrichedData.status !== 'NO_QUALITY_CONTACTS')) {
        const finalStatus = enrichedData?.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        const timestamp = new Date().toISOString();
        
        // Get existing history
        const existingHistory = lead.skipTraceHistory || [];
        const newHistory = [...existingHistory, {
          timestamp,
          status: finalStatus,
          phonesFound: 0,
          emailsFound: 0
        }];
        
        await docClient.send(new UpdateCommand({
          TableName: propertyLeadTableName,
          Key: { id: lead.id },
          UpdateExpression: 'SET skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, skipTraceHistory = :history',
          ExpressionAttributeValues: { 
            ':status': finalStatus,
            ':completedAt': timestamp,
            ':history': newHistory
          }
        }));
        return { id: lead.id, status: finalStatus };
      }

      // Store ALL raw data regardless of quality
      const rawData = {
        allPhones: enrichedData.rawPersonData?.phoneNumbers || [],
        allEmails: enrichedData.rawPersonData?.emails || [],
        batchDataMailingAddress: enrichedData.mailingData || null, // Store BatchData's mailing address
      };

      // Determine status based on quality filters
      const hasQualityContacts = enrichedData.foundPhones.length > 0 || enrichedData.foundEmails.length > 0;
      const timestamp = new Date().toISOString();
      
      if (!hasQualityContacts) {
        const currentLabels = lead.leadLabels || [];
        const updatedLabels = [...new Set([...currentLabels, 'DIRECT_MAIL_ONLY'])];
        
        // Get existing history
        const existingHistory = lead.skipTraceHistory || [];
        const newHistory = [...existingHistory, {
          timestamp,
          status: 'NO_QUALITY_CONTACTS',
          phonesFound: enrichedData.rawPersonData?.phoneNumbers?.length || 0,
          emailsFound: enrichedData.rawPersonData?.emails?.length || 0
        }];
        
        const updateExpression = lead.type?.toUpperCase() === 'PROBATE'
          ? 'SET skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, skipTraceHistory = :history, leadLabels = :labels, rawSkipTraceData = :rawData'
          : 'SET ownerFirstName = :firstName, ownerLastName = :lastName, mailingAddress = :mailingAddress, mailingCity = :mailingCity, mailingState = :mailingState, mailingZip = :mailingZip, skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, skipTraceHistory = :history, leadLabels = :labels, rawSkipTraceData = :rawData';
        
        await docClient.send(new UpdateCommand({
          TableName: propertyLeadTableName,
          Key: { id: lead.id },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: {
            ...(lead.type?.toUpperCase() !== 'PROBATE' && {
              ':firstName': enrichedData.firstName || null,
              ':lastName': enrichedData.lastName || null,
              ':mailingAddress': enrichedData.mailingData?.mailingAddress || null,
              ':mailingCity': enrichedData.mailingData?.mailingCity || null,
              ':mailingState': enrichedData.mailingData?.mailingState || null,
              ':mailingZip': enrichedData.mailingData?.mailingZip || null,
            }),
            ':status': 'NO_QUALITY_CONTACTS',
            ':completedAt': timestamp,
            ':history': newHistory,
            ':labels': updatedLabels,
            ':rawData': rawData
          }
        }));
        return { id: lead.id, status: 'NO_QUALITY_CONTACTS' };
      }

      const newPhones = [...new Set([...(lead.phones || []), ...enrichedData.foundPhones])];
      const newEmails = [...new Set([...(lead.emails || []), ...enrichedData.foundEmails])];

      // Get existing history
      const existingHistory = lead.skipTraceHistory || [];
      const newHistory = [...existingHistory, {
        timestamp,
        status: 'COMPLETED',
        phonesFound: enrichedData.foundPhones.length,
        emailsFound: enrichedData.foundEmails.length
      }];

      const updateExpression = lead.type?.toUpperCase() === 'PROBATE'
        ? 'SET phones = :phones, emails = :emails, skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, skipTraceHistory = :history, rawSkipTraceData = :rawData'
        : 'SET ownerFirstName = :firstName, ownerLastName = :lastName, phones = :phones, emails = :emails, mailingAddress = :mailingAddress, mailingCity = :mailingCity, mailingState = :mailingState, mailingZip = :mailingZip, skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, skipTraceHistory = :history, rawSkipTraceData = :rawData';

      await docClient.send(new UpdateCommand({
        TableName: propertyLeadTableName,
        Key: { id: lead.id },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
          ...(lead.type?.toUpperCase() !== 'PROBATE' && {
            ':firstName': enrichedData.firstName || null,
            ':lastName': enrichedData.lastName || null,
            ':mailingAddress': enrichedData.mailingData?.mailingAddress || lead.ownerAddress,
            ':mailingCity': enrichedData.mailingData?.mailingCity || lead.ownerCity,
            ':mailingState': enrichedData.mailingData?.mailingState || lead.ownerState,
            ':mailingZip': enrichedData.mailingData?.mailingZip || lead.ownerZip,
          }),
          ':status': 'COMPLETED',
          ':completedAt': timestamp,
          ':history': newHistory,
          ':rawData': rawData
        }
      }));

      return { id: lead.id, status: 'SUCCESS', phones: newPhones.length };
    });

    const updateResults = await Promise.all(updatePromises);
    results.push(...updateResults);

    const processedSuccessfully = updateResults.filter(r => r.status === 'SUCCESS').length;
    const noQualityContacts = updateResults.filter(r => r.status === 'NO_QUALITY_CONTACTS').length;
    const noMatch = updateResults.filter(r => r.status === 'NO_MATCH').length;
    const failed = updateResults.filter(r => r.status === 'FAILED').length;

    console.log(`✅ Database updates complete`);
    console.log(`📊 Results: ${processedSuccessfully} successful, ${noQualityContacts} no quality contacts, ${noMatch} no match, ${failed} failed`);

    // 💰 7. Deduct Credits (all users except OWNER)
    if (processedSuccessfully > 0 && !isOwner && userAccount) {
      console.log(`💳 Deducting ${processedSuccessfully} credits...`);
      await docClient.send(new UpdateCommand({
        TableName: userAccountTableName,
        Key: { id: userAccount.id },
        UpdateExpression: 'SET credits = :newCredits, totalSkipsPerformed = :newTotal',
        ExpressionAttributeValues: {
          ':newCredits': (userAccount.credits || 0) - processedSuccessfully,
          ':newTotal': (userAccount.totalSkipsPerformed || 0) + processedSuccessfully
        }
      }));
    }

    console.log('✅ Skip trace handler completed successfully');
    console.log(`📤 Returning ${results.length} results`);
    
    return results; // Return as JSON string for your mutation return type
  } catch (error: any) {
    console.error('🔥 Lambda Handler Error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};
