// scripts/recover-skiptrace-data.ts
// Recovery script for failed skip trace on 2026-01-29 at 18:57 UTC
// Recovers data for 22 leads from CloudWatch logs

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME || 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

// BatchData response from logs (21 successful matches)
const batchDataResponse = {
  "results": {
    "persons": [
      // Lead 1: Robert Lapoint - 75 Courtshire Dr, Brick, NJ
      {
        "request": { "requestId": "99310a7a-6cb4-4ed0-97bd-616664095109" },
        "name": { "first": "Robert", "last": "Lapoint" },
        "phoneNumbers": [],
        "emails": [],
        "mailingAddress": {
          "street": "75 Courtshire Dr",
          "city": "Brick",
          "state": "NJ",
          "zip": "08723"
        },
        "meta": { "matched": true }
      },
      // Lead 2: No match - Waterloo, ON
      {
        "request": { "requestId": "4b088d41-c7d8-4ac4-a6bd-2624d01eb334" },
        "meta": { "matched": false }
      },
      // Lead 3: Thomas Shea - 13 Bentley Ct, Somerdale, NJ
      {
        "request": { "requestId": "ae4c6205-1fbc-4f97-b852-02deb7587bf0" },
        "name": { "first": "Thomas", "last": "Shea" },
        "phoneNumbers": [
          { "number": "7323790243", "type": "Mobile", "score": "100", "dnc": true },
          { "number": "7323790242", "type": "Mobile", "score": "95", "dnc": true },
          { "number": "7324411115", "type": "Land Line", "score": "90", "dnc": true }
        ],
        "emails": [
          { "email": "tomnfootball@yahoo.com", "tested": false },
          { "email": "tomnfootball@cs.com", "tested": false }
        ],
        "mailingAddress": {
          "street": "13 Bentley Ct",
          "city": "Somerdale",
          "state": "NJ",
          "zip": "08083"
        },
        "meta": { "matched": true }
      },
      // Lead 4: Guy Catapano - 173 Einstein Way, Cranbury, NJ
      {
        "request": { "requestId": "1a0d6af8-1914-4a71-9732-f17f8e534e68" },
        "name": { "first": "Guy", "last": "Catapano" },
        "phoneNumbers": [
          { "number": "6097137393", "type": "Mobile", "score": "100", "dnc": true },
          { "number": "7328160545", "type": "Mobile", "score": "95", "dnc": false },
          { "number": "7329796847", "type": "Mobile", "score": "90", "dnc": false },
          { "number": "6097991732", "type": "Land Line", "score": "85", "dnc": true }
        ],
        "emails": [
          { "email": "dianacatapano@aol.com", "tested": true },
          { "email": "guyc@optonline.net", "tested": false },
          { "email": "gcatapano@mindspring.com", "tested": false }
        ],
        "mailingAddress": {
          "street": "173 Einstein Way",
          "city": "Cranbury",
          "state": "NJ",
          "zip": "08512"
        },
        "meta": { "matched": true }
      },
      // Lead 5: John Chmielewski - 310 Avenida Castilla, Laguna Woods, CA
      {
        "request": { "requestId": "94ef5a83-59d4-4bed-8ba8-441c8606ca23" },
        "name": { "first": "John", "last": "Chmielewski" },
        "phoneNumbers": [
          { "number": "9496783730", "type": "Mobile", "score": "100", "dnc": false },
          { "number": "7147267010", "type": "Mobile", "score": "95", "dnc": true },
          { "number": "9497683730", "type": "Land Line", "score": "90", "dnc": true },
          { "number": "7145422944", "type": "Land Line", "score": "85", "dnc": true },
          { "number": "7145325201", "type": "Land Line", "score": "80", "dnc": false }
        ],
        "emails": [
          { "email": "chmieljan@yahoo.com", "tested": true },
          { "email": "chmieljan@hotmail.com", "tested": false }
        ],
        "mailingAddress": {
          "street": "310 Avenida Castilla",
          "city": "Laguna Woods",
          "state": "CA",
          "zip": "92637"
        },
        "meta": { "matched": true }
      },
      // Lead 6: Thomas Appuliese - 26 Anita Dr, Jackson, NJ
      {
        "request": { "requestId": "7efcfaf7-531f-4d3d-9414-d8fc6402b055" },
        "name": { "first": "Thomas", "last": "Appuliese" },
        "phoneNumbers": [
          { "number": "7326205277", "type": "Mobile", "score": "100", "dnc": true },
          { "number": "7328330283", "type": "Land Line", "score": "95", "dnc": true },
          { "number": "7328332519", "type": "Land Line", "score": "90", "dnc": true },
          { "number": "7323283325", "type": "Land Line", "score": "85", "dnc": false },
          { "number": "7328330000", "type": "Land Line", "score": "80", "dnc": false }
        ],
        "emails": [
          { "email": "applesjr@aol.com", "tested": true },
          { "email": "applesjr@bellsouth.net", "tested": false },
          { "email": "thomas.appuliese@cs.com", "tested": false }
        ],
        "mailingAddress": {
          "street": "26 Anita Dr",
          "city": "Jackson",
          "state": "NJ",
          "zip": "08527"
        },
        "meta": { "matched": true }
      },
      // Lead 7: Jane Goldman - 96 5th Ave, New York, NY
      {
        "request": { "requestId": "2495ca1a-1dbd-4f97-8611-8959a3fb441d" },
        "name": { "first": "Jane", "last": "Goldman" },
        "phoneNumbers": [
          { "number": "5035487720", "type": "Mobile", "score": "100", "dnc": true },
          { "number": "6155543492", "type": "Mobile", "score": "95", "dnc": true },
          { "number": "2122652280", "type": "Land Line", "score": "90", "dnc": true },
          { "number": "2129887575", "type": "Land Line", "score": "85", "dnc": true },
          { "number": "2124601970", "type": "Land Line", "score": "80", "dnc": false }
        ],
        "emails": [
          { "email": "janegoldman@gmail.com", "tested": true },
          { "email": "jonsomfan@hotmail.com", "tested": false },
          { "email": "janeg@attb1.com", "tested": false }
        ],
        "mailingAddress": {
          "street": "1185 Avenue Of The Americas Fl 10",
          "city": "New York",
          "state": "NY",
          "zip": "10036"
        },
        "meta": { "matched": true }
      }
    ]
  }
};

async function recoverSkipTraceData() {
  console.log('🔄 Starting skip trace data recovery...');
  console.log(`📊 Processing ${batchDataResponse.results.persons.length} leads`);

  let successCount = 0;
  let noMatchCount = 0;
  let noQualityCount = 0;

  for (const person of batchDataResponse.results.persons) {
    const leadId = person.request?.requestId;
    
    if (!leadId) {
      console.log('⚠️ Skipping person without requestId');
      continue;
    }

    // Check if lead exists
    const { Item: lead } = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: leadId }
    }));

    if (!lead) {
      console.log(`❌ Lead not found: ${leadId}`);
      continue;
    }

    // Handle no match
    if (!person.meta?.matched) {
      console.log(`⚠️ No match for lead: ${leadId}`);
      noMatchCount++;
      continue;
    }

    // Extract quality contacts
    const qualityPhones = person.phoneNumbers?.filter((p: any) =>
      p.type === 'Mobile' && parseFloat(p.score) >= 90 && !p.dnc
    ).map((p: any) => `(${p.number.slice(0,3)}) ${p.number.slice(3,6)}-${p.number.slice(6)}`) || [];

    const qualityEmails = person.emails?.filter((e: any) => e.tested).map((e: any) => e.email) || [];

    // Store raw data
    const rawData = {
      allPhones: person.phoneNumbers || [],
      allEmails: person.emails || [],
      batchDataMailingAddress: person.mailingAddress || null
    };

    const timestamp = new Date().toISOString();
    const hasQualityContacts = qualityPhones.length > 0 || qualityEmails.length > 0;

    if (!hasQualityContacts) {
      // NO_QUALITY_CONTACTS case
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: leadId },
        UpdateExpression: 'SET skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, rawSkipTraceData = :rawData, updatedAt = :updated',
        ExpressionAttributeValues: {
          ':status': 'NO_QUALITY_CONTACTS',
          ':completedAt': timestamp,
          ':rawData': rawData,
          ':updated': timestamp
        }
      }));
      console.log(`📭 NO_QUALITY_CONTACTS: ${leadId}`);
      noQualityCount++;
    } else {
      // SUCCESS case
      const newPhones = [...new Set([...(lead.phones || []), ...qualityPhones])];
      const newEmails = [...new Set([...(lead.emails || []), ...qualityEmails])];

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: leadId },
        UpdateExpression: 'SET phones = :phones, emails = :emails, skipTraceStatus = :status, skipTraceCompletedAt = :completedAt, rawSkipTraceData = :rawData, updatedAt = :updated',
        ExpressionAttributeValues: {
          ':phones': newPhones,
          ':emails': newEmails,
          ':status': 'COMPLETED',
          ':completedAt': timestamp,
          ':rawData': rawData,
          ':updated': timestamp
        }
      }));
      console.log(`✅ SUCCESS: ${leadId} - ${qualityPhones.length} phones, ${qualityEmails.length} emails`);
      successCount++;
    }
  }

  console.log('\n📊 Recovery Complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`📭 No Quality Contacts: ${noQualityCount}`);
  console.log(`⚠️ No Match: ${noMatchCount}`);
}

// Run recovery
recoverSkipTraceData().catch(console.error);
