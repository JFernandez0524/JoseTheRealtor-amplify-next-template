import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_BASE = 'https://services.leadconnectorhq.com';

// Helper to get OAuth token for a locationId
async function getGhlTokenForLocation(locationId: string) {
  try {
    const tableName = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;
    if (!tableName) {
      console.error('GhlIntegration table name not found');
      return null;
    }

    const result = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'locationId = :locationId',
      ExpressionAttributeValues: {
        ':locationId': locationId
      }
    }));

    const integration = result.Items?.[0];
    if (!integration?.accessToken) {
      console.error(`No OAuth token found for locationId: ${locationId}`);
      return null;
    }

    return integration.accessToken;
  } catch (error) {
    console.error('Error getting GHL token:', error);
    return null;
  }
}

// GHL Public Key for webhook verification
const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

// Store processed webhook IDs (use database in production)
const processedWebhooks = new Set<string>();

function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    return verifier.verify(GHL_PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // 1. Verify webhook signature
    const signature = req.headers.get('x-wh-signature');
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Check for duplicates
    if (body.webhookId && processedWebhooks.has(body.webhookId)) {
      console.log('Duplicate webhook, skipping:', body.webhookId);
      return NextResponse.json({ message: 'Already processed' });
    }

    // 3. Log the webhook
    console.log("Campaign webhook payload:", JSON.stringify(body, null, 2));
    
    const { type, contactId, contact, status, locationId, webhookId } = body;

    if (!type || !contactId) {
      return NextResponse.json({ success: true, message: 'Ignored' });
    }

    // 4. Process asynchronously (don't block response)
    setImmediate(() => {
      processWebhookAsync(body);
    });

    // 5. Mark as processed
    if (webhookId) {
      processedWebhooks.add(webhookId);
    }

    // 6. Respond immediately
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Campaign webhook error:', error);
    // Return 200 even for processing errors (as per GHL docs)
    return NextResponse.json({ success: false, error: 'Processing failed' });
  }
}

async function processWebhookAsync(body: any) {
  try {
    const { type, contactId, contact, status, locationId } = body;

    if (type === 'CampaignStatusUpdate') {
      await handleCampaignStatus({ contactId, contact, status, locationId });
    }

    if (type === 'ContactTagUpdate' && body.tags?.includes('Bad-Number')) {
      await handleBadNumber({ contactId, contact, locationId });
    }

    console.log('Successfully processed webhook:', body.webhookId);
  } catch (error) {
    console.error('Failed to process webhook:', body.webhookId, error);
  }
}

async function handleCampaignStatus({
  contactId,
  contact,
  status,
  locationId
}: {
  contactId: string;
  contact: any;
  status: string;
  locationId: string;
}) {
  try {
    const leadSourceId = contact?.customFields?.find((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')?.value;
    
    // 🚨 SAFETY GUARD: Don't proceed if missing required data
    if (!leadSourceId || !locationId) return;

    // Get OAuth token for this location
    const accessToken = await getGhlTokenForLocation(locationId);
    if (!accessToken) {
      console.error(`No OAuth token available for locationId: ${locationId}`);
      return;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28'
    };
    
    // 🚨 TODO: Adjust these status values based on real GHL payload logs
    const isNoResponse = status === 'no_response' || status === 'failed';
    const isQualified = status === 'responded' || status === 'qualified';

    if (isNoResponse) {
      // Check if this contact has siblings (same lead_source_id)
      const searchResponse = await axios.post(
        `${GHL_BASE}/contacts/search`,
        {
          locationId,
          filters: [
            { field: 'customField', customFieldId: 'PBInTgsd2nMCD3Ngmy0a', operator: 'eq', value: leadSourceId }
          ]
        },
        { headers }
      );

      const siblings = searchResponse.data?.contacts || [];
      
      if (siblings.length > 1) {
        // 🚨 SAFETY GUARD: Don't delete Primary Contact
        const tags = contact?.tags || [];
        if (tags.includes('primary_contact')) return;
        
        // Delete this specific contact (bad number)
        await axios.delete(`${GHL_BASE}/contacts/${contactId}`, { headers });
        console.log(`Deleted contact ${contactId} - bad number with siblings`);
      } else {
        // Last contact for this lead - move to direct mail
        await axios.post(
          `${GHL_BASE}/contacts/${contactId}/tags`,
          { tags: ['Move-To-Direct-Mail'] },
          { headers }
        );

        // Update contact type to Direct Mail
        await axios.put(
          `${GHL_BASE}/contacts/${contactId}`,
          {
            customFields: [
              { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Direct Mail' },
              { id: '1NxQW2kKMVgozjSUuu7s', value: 'paused' } // Pause AI for direct mail
            ]
          },
          { headers }
        );

        console.log(`Moved contact ${contactId} to direct mail - last number for lead`);
      }
    }

    if (isQualified) {
      // Tag for human follow-up
      await axios.post(
        `${GHL_BASE}/contacts/${contactId}/tags`,
        { tags: ['Qualified-Lead', 'Ready-For-Human-Contact'] },
        { headers }
      );
      console.log(`Tagged contact ${contactId} as qualified lead`);
    }

  } catch (error) {
    console.error('Campaign status handling error:', error);
  }
}

async function handleBadNumber({
  contactId,
  contact,
  locationId
}: {
  contactId: string;
  contact: any;
  locationId: string;
}) {
  try {
    const leadSourceId = contact?.customFields?.find((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')?.value;
    
    // 🚨 SAFETY GUARD: Don't proceed if missing required data
    if (!leadSourceId || !locationId) return;

    // Get OAuth token for this location
    const accessToken = await getGhlTokenForLocation(locationId);
    if (!accessToken) {
      console.error(`No OAuth token available for locationId: ${locationId}`);
      return;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28'
    };
    
    // Find siblings with same lead_source_id
    const searchResponse = await axios.post(
      `${GHL_BASE}/contacts/search`,
      {
        locationId,
        filters: [
          { field: 'customField', customFieldId: 'PBInTgsd2nMCD3Ngmy0a', operator: 'eq', value: leadSourceId }
        ]
      },
      { headers }
    );

    const siblings = searchResponse.data?.contacts || [];
    
    if (siblings.length > 1) {
      // 🚨 SAFETY GUARD: Don't delete Primary Contact
      const tags = contact?.tags || [];
      if (tags.includes('primary_contact')) return;
      
      // Delete this bad number contact
      await axios.delete(`${GHL_BASE}/contacts/${contactId}`, { headers });
      console.log(`Deleted bad number contact ${contactId}`);
    } else {
      // Last contact - convert to direct mail
      await axios.put(
        `${GHL_BASE}/contacts/${contactId}`,
        {
          phone: '', // Remove bad phone
          customFields: [
            { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Direct Mail' },
            { id: '1NxQW2kKMVgozjSUuu7s', value: 'paused' } // Pause AI
          ]
        },
        { headers }
      );

      await axios.post(
        `${GHL_BASE}/contacts/${contactId}/tags`,
        { tags: ['Direct-Mail-Only', 'Bad-Phone-Removed'] }, // Outcome tag
        { headers }
      );

      console.log(`Converted contact ${contactId} to direct mail only`);
    }

  } catch (error) {
    console.error('Bad number handling error:', error);
  }
}
