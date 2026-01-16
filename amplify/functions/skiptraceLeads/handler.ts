import axios, { isAxiosError } from 'axios';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DATA_SERVER_TOKEN = process.env.BATCH_DATA_SERVER_TOKEN;
const propertyLeadTableName = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const userAccountTableName = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME;

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
  status: 'SUCCESS' | 'NO_MATCH' | 'INVALID_GEO' | 'ERROR';
  foundPhones: string[];
  foundEmails: string[];
  mailingData?: MailingAddressData | null;
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
  if (!BATCH_DATA_SERVER_TOKEN) throw new Error('Missing BatchData API Key');

  const requests = leads.map(lead => {
    let targetAddress = {
      street: lead.ownerAddress?.trim() || '',
      city: lead.ownerCity?.trim() || '',
      state: lead.ownerState?.trim().toUpperCase() || '',
      zip: lead.ownerZip?.trim() || '',
    };

    if (lead.type?.toUpperCase() === 'PROBATE') {
      targetAddress = {
        street: lead.adminAddress?.trim() || '',
        city: lead.adminCity?.trim() || '',
        state: lead.adminState?.trim().toUpperCase() || '',
        zip: lead.adminZip?.trim() || '',
      };
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

      const resultMap = new Map<string, BatchDataResult>();
      const resultsArray = res.data?.results || [];

      for (const result of resultsArray) {
        const leadId = result.requestId;
        if (!result.persons?.length) {
          resultMap.set(leadId, {
            status: 'NO_MATCH',
            foundPhones: [],
            foundEmails: [],
            mailingData: null,
          });
          continue;
        }

        const person = result.persons[0];
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

        resultMap.set(leadId, { status: 'SUCCESS', foundPhones, foundEmails, mailingData });
      }

      return resultMap;
    } catch (error: any) {
      if (
        isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < MAX_RETRIES - 1
      ) {
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
        continue;
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
  const { leadIds } = event.arguments;
  const identity = event.identity;

  let ownerId: string | undefined;
  let groups: string[] = [];

  // 🛡️ 1. Extract Identity Safely
  if (identity && 'sub' in identity) {
    ownerId = identity.sub;
    groups = (identity as any).claims?.['cognito:groups'] || [];
  }

  if (!ownerId || !leadIds?.length) {
    throw new Error('Unauthorized: Missing user identity or lead data.');
  }

  // 🛡️ 2. Tier Authorization Check
  const isAuthorized = groups.some((g: string) =>
    ['PRO', 'AI_PLAN', 'ADMINS'].includes(g)
  );

  if (!isAuthorized) {
    throw new Error(
      'Forbidden: A paid membership is required to use this feature.'
    );
  }

  try {
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
    const isAdmin = groups.includes('ADMINS');
    const isPro = groups.includes('PRO');

    // All users (FREE and PRO) need credits for skip tracing, except ADMIN
    if (!isAdmin) {
      // Check credit expiration for FREE users only
      if (!isPro && userAccount?.creditsExpiresAt) {
        const expirationDate = new Date(userAccount.creditsExpiresAt);
        const now = new Date();
        if (now > expirationDate) {
          throw new Error('Credits have expired. Please upgrade to PRO or purchase more credits.');
        }
      }

      if (!userAccount || (userAccount.credits || 0) < leadIds.length) {
        throw new Error(
          `Insufficient Credits: Need ${leadIds.length}, have ${userAccount?.credits || 0}. Purchase skip tracing credits to continue.`
        );
      }
    }

    // 🛡️ 4. Fetch all leads upfront
    const leads = [];
    for (const leadId of leadIds) {
      if (!leadId) continue;
      const { Item: lead } = await docClient.send(new GetCommand({
        TableName: propertyLeadTableName,
        Key: { id: leadId }
      }));
      if (lead && (lead.owner ?? '') === ownerId) {
        leads.push(lead);
      }
    }

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
      return results;
    }

    // 5. Call BatchData once with all leads
    const enrichmentMap = await callBatchDataBulk(leadsToProcess);

    // 6. Update all leads in parallel
    const updatePromises = leadsToProcess.map(async (lead) => {
      const enrichedData = enrichmentMap.get(lead.id);
      if (!enrichedData || enrichedData.status !== 'SUCCESS') {
        const finalStatus = enrichedData?.status === 'ERROR' ? 'FAILED' : 'NO_MATCH';
        await docClient.send(new UpdateCommand({
          TableName: propertyLeadTableName,
          Key: { id: lead.id },
          UpdateExpression: 'SET skipTraceStatus = :status',
          ExpressionAttributeValues: { ':status': finalStatus }
        }));
        return { id: lead.id, status: finalStatus };
      }

      const newPhones = [...new Set([...(lead.phones || []), ...enrichedData.foundPhones])];
      const newEmails = [...new Set([...(lead.emails || []), ...enrichedData.foundEmails])];

      await docClient.send(new UpdateCommand({
        TableName: propertyLeadTableName,
        Key: { id: lead.id },
        UpdateExpression: 'SET phones = :phones, emails = :emails, mailingAddress = :mailingAddress, mailingCity = :mailingCity, mailingState = :mailingState, mailingZip = :mailingZip, skipTraceStatus = :status, skipTraceCompletedAt = :completedAt',
        ExpressionAttributeValues: {
          ':phones': newPhones,
          ':emails': newEmails,
          ':mailingAddress': enrichedData.mailingData?.mailingAddress || lead.ownerAddress,
          ':mailingCity': enrichedData.mailingData?.mailingCity || lead.ownerCity,
          ':mailingState': enrichedData.mailingData?.mailingState || lead.ownerState,
          ':mailingZip': enrichedData.mailingData?.mailingZip || lead.ownerZip,
          ':status': 'COMPLETED',
          ':completedAt': new Date().toISOString()
        }
      }));

      return { id: lead.id, status: 'SUCCESS', phones: newPhones.length };
    });

    const updateResults = await Promise.all(updatePromises);
    results.push(...updateResults);

    const processedSuccessfully = updateResults.filter(r => r.status === 'SUCCESS').length;

    // 💰 7. Deduct Credits (all users except ADMIN)
    if (processedSuccessfully > 0 && !isAdmin && userAccount) {
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

    return results; // Return as JSON string for your mutation return type
  } catch (error: any) {
    console.error('🔥 Lambda Handler Error:', error.message);
    throw error;
  }
};
