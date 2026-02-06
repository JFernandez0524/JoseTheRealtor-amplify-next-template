/**
 * Fix orphaned leads by assigning them to a user
 * Run with: npx tsx scripts/fix-orphaned-leads.ts <userId>
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME || 'PropertyLead-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

const orphanedLeadIds = [
  'ec12df25-ebaf-4b84-b053-4e156de7414e',
  '5dd1a413-2b57-4f36-8232-10e9eb667292',
  '3c070a2c-bb6b-4dea-9f62-bc65f7d5922c',
  '624c0b7e-56f2-47ce-84f6-ef7952536aa5',
  'f5866352-0040-4e5c-892b-ae6131a25798',
  '30a04291-ceee-46ef-9118-24d74844a3ce',
  'a6376c45-f387-4013-becc-6e5572eaa731',
  '56b1f3e1-206b-4184-b0b5-64b54577bfab',
  '9f64fe7f-e676-487d-9f8b-13a0949b0e58',
  '3b4f443c-826c-4ff5-a798-37402950a13b',
  '5da00770-0c04-4026-9d02-ce7172ab5a34',
  '62d3660a-7da2-4e1d-b681-ff19c84ab573',
  'e55b6c15-e3e0-4e8c-978b-5b007d8d9680',
  '9227095f-f195-4bc5-b6e8-4a5cf0ff9757'
];

async function fixOrphanedLeads(userId: string, action: 'assign' | 'delete') {
  console.log(`🔧 ${action === 'assign' ? 'Assigning' : 'Deleting'} ${orphanedLeadIds.length} orphaned leads...`);

  if (action === 'assign') {
    // Assign to user
    for (const leadId of orphanedLeadIds) {
      try {
        await dynamodb.send(new UpdateCommand({
          TableName: LEAD_TABLE,
          Key: { id: leadId },
          UpdateExpression: 'SET userId = :userId, ghlSyncStatus = :status',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':status': 'PENDING'
          }
        }));
        console.log(`✅ Assigned ${leadId} to ${userId}`);
      } catch (err: any) {
        console.error(`❌ Failed to assign ${leadId}:`, err.message);
      }
    }
  } else {
    // Delete in batches of 25
    const batches = [];
    for (let i = 0; i < orphanedLeadIds.length; i += 25) {
      batches.push(orphanedLeadIds.slice(i, i + 25));
    }

    for (const batch of batches) {
      try {
        await dynamodb.send(new BatchWriteCommand({
          RequestItems: {
            [LEAD_TABLE]: batch.map(id => ({
              DeleteRequest: { Key: { id } }
            }))
          }
        }));
        console.log(`✅ Deleted batch of ${batch.length} leads`);
      } catch (err: any) {
        console.error(`❌ Failed to delete batch:`, err.message);
      }
    }
  }

  console.log('✅ Done!');
}

// Get command line args
const userId = process.argv[2];
const action = process.argv[3] as 'assign' | 'delete';

if (!userId || !action || !['assign', 'delete'].includes(action)) {
  console.error('Usage: npx tsx scripts/fix-orphaned-leads.ts <userId> <assign|delete>');
  console.error('Example: npx tsx scripts/fix-orphaned-leads.ts abc123 assign');
  process.exit(1);
}

fixOrphanedLeads(userId, action);
