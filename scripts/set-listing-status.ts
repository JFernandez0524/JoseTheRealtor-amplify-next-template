/**
 * Script to set listingStatus = 'OFF_MARKET' for all leads with empty listingStatus
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

async function main() {
  console.log('🔄 Setting listingStatus to OFF_MARKET for all leads...\n');

  let allLeads: any[] = [];
  let lastEvaluatedKey: any = undefined;
  
  // Fetch all leads with pagination
  do {
    const leadsResult = await dynamodb.send(new ScanCommand({
      TableName: LEAD_TABLE,
      FilterExpression: '#owner = :userId',
      ExpressionAttributeNames: {
        '#owner': 'owner'
      },
      ExpressionAttributeValues: {
        ':userId': USER_ID
      },
      ExclusiveStartKey: lastEvaluatedKey
    }));

    allLeads = allLeads.concat(leadsResult.Items || []);
    lastEvaluatedKey = leadsResult.LastEvaluatedKey;
    
    console.log(`Fetched ${leadsResult.Items?.length || 0} leads (total: ${allLeads.length})`);
  } while (lastEvaluatedKey);

  console.log(`\nFound ${allLeads.length} total leads\n`);

  // Filter leads with empty or uppercase listingStatus
  const leadsToUpdate = allLeads.filter(lead => 
    !lead.listingStatus || lead.listingStatus === 'OFF_MARKET'
  );
  console.log(`${leadsToUpdate.length} leads need listingStatus fixed\n`);

  let updated = 0;
  let failed = 0;

  for (const lead of leadsToUpdate) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: LEAD_TABLE,
        Key: { id: lead.id },
        UpdateExpression: 'SET listingStatus = :status',
        ExpressionAttributeValues: {
          ':status': 'off_market'
        }
      }));

      console.log(`✅ Updated ${lead.ownerFirstName} ${lead.ownerLastName} (${lead.ownerAddress})`);
      updated++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`❌ Failed for ${lead.id}:`, error.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`\nNow run: npx tsx scripts/tag-status-contacts.ts`);
}

main().catch(console.error);
