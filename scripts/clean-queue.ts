import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function cleanQueue() {
  console.log('🧹 Scanning for contacts without phone or email...');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'attribute_not_exists(contactPhone) AND attribute_not_exists(contactEmail)',
  }));

  const items = result.Items || [];
  console.log(`Found ${items.length} contacts to delete`);

  if (items.length === 0) {
    console.log('✅ Queue is clean!');
    return;
  }

  // Delete each item
  let deleted = 0;
  for (const item of items) {
    try {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: item.id },
      }));
      deleted++;
      console.log(`Deleted ${deleted}/${items.length}: ${item.contactName || item.contactId}`);
    } catch (error) {
      console.error(`Failed to delete ${item.id}:`, error);
    }
  }

  console.log(`✅ Deleted ${deleted} contacts from queue`);
}

cleanQueue().catch(console.error);
