import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function removeFromQueue(contactId: string, ghlToken?: string) {
  console.log(`🗑️ Removing contact ${contactId} from outreach queue...`);

  // Scan for all queue entries for this contact (no index available)
  const result = await dynamodb.send(new ScanCommand({
    TableName: QUEUE_TABLE,
    FilterExpression: 'contactId = :contactId',
    ExpressionAttributeValues: { ':contactId': contactId }
  }));

  if (!result.Items || result.Items.length === 0) {
    console.log('❌ Contact not found in queue');
    return;
  }

  // Delete all entries
  for (const item of result.Items) {
    await dynamodb.send(new DeleteCommand({
      TableName: QUEUE_TABLE,
      Key: { id: item.id }
    }));
    console.log(`✅ Deleted queue entry: ${item.id}`);
  }

  // Add exclusion tag in GHL if token provided
  if (ghlToken) {
    try {
      await axios.put(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        { tags: ['human contacted'] },
        {
          headers: {
            'Authorization': `Bearer ${ghlToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          }
        }
      );
      console.log('✅ Added "human contacted" tag in GHL');
    } catch (err: any) {
      console.error('❌ Failed to add tag:', err.message);
    }
  }

  console.log('✅ Done!');
}

const contactId = process.argv[2];
const ghlToken = process.argv[3];

if (!contactId) {
  console.error('Usage: npx tsx scripts/remove-from-queue.ts <contactId> [ghlToken]');
  process.exit(1);
}

removeFromQueue(contactId, ghlToken);
