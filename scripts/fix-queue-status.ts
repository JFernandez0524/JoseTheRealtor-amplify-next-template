import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function fixMissingStatuses() {
  console.log('🔍 Scanning for items with missing status fields...');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));

  const items = result.Items || [];
  let fixed = 0;

  for (const item of items) {
    const needsUpdate = !item.queueStatus || !item.emailStatus;
    
    if (needsUpdate) {
      console.log(`Fixing item ${item.id}: queueStatus=${item.queueStatus}, emailStatus=${item.emailStatus}`);
      
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: item.id },
        UpdateExpression: 'SET queueStatus = if_not_exists(queueStatus, :outreach), emailStatus = if_not_exists(emailStatus, :pending)',
        ExpressionAttributeValues: {
          ':outreach': 'OUTREACH',
          ':pending': 'PENDING',
        },
      }));
      
      fixed++;
    }
  }

  console.log(`✅ Fixed ${fixed} items with missing status fields`);
}

fixMissingStatuses().catch(console.error);
