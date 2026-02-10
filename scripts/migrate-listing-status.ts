/**
 * Migration script to rename manualStatus to listingStatus
 * 
 * - Converts existing manualStatus values to new listingStatus format
 * - Sets default "off market" for leads without any status
 * - Preserves existing status values
 * 
 * Usage: npx tsx scripts/migrate-listing-status.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const LEAD_TABLE = 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

// Mapping from old manualStatus to new listingStatus
const STATUS_MAPPING: Record<string, string> = {
  'ACTIVE': 'active',
  'SOLD': 'sold',
  'PENDING': 'pending',
  'OFF_MARKET': 'off market',
  'SKIP': 'skip',
  'DIRECT_MAIL': 'off market', // Direct mail leads are off market
};

async function main() {
  console.log('🔄 Starting listingStatus migration...\n');

  // Scan all leads
  let lastEvaluatedKey: any = undefined;
  let totalProcessed = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: LEAD_TABLE,
      ExclusiveStartKey: lastEvaluatedKey
    }));

    const leads = result.Items || [];
    console.log(`📦 Processing batch of ${leads.length} leads...`);

    for (const lead of leads) {
      totalProcessed++;

      // Skip if already has listingStatus
      if (lead.listingStatus) {
        skipped++;
        continue;
      }

      // Determine new listingStatus value
      let newStatus = 'off market'; // Default

      if (lead.manualStatus) {
        // Convert old status to new format
        newStatus = STATUS_MAPPING[lead.manualStatus] || 'off market';
      }

      // Update the lead
      try {
        await dynamodb.send(new UpdateCommand({
          TableName: LEAD_TABLE,
          Key: { id: lead.id },
          UpdateExpression: 'SET listingStatus = :status REMOVE manualStatus',
          ExpressionAttributeValues: {
            ':status': newStatus
          }
        }));

        console.log(`✅ ${lead.ownerFirstName} ${lead.ownerLastName}: ${lead.manualStatus || 'none'} → ${newStatus}`);
        updated++;
      } catch (error) {
        console.error(`❌ Failed to update ${lead.id}:`, error);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Total Processed: ${totalProcessed}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️ Skipped (already migrated): ${skipped}`);
  console.log(`\n✅ Migration complete!`);
}

main().catch(console.error);
