import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function checkWrongEmails() {
  console.log('🚨 Checking for wrong/bounced emails...\n');

  const result = await dynamodb.send(new ScanCommand({
    TableName: QUEUE_TABLE,
    FilterExpression: 'emailStatus = :bounced',
    ExpressionAttributeValues: {
      ':bounced': 'BOUNCED'
    }
  }));

  const items = result.Items || [];
  
  console.log(`Total Bounced/Wrong Emails: ${items.length}\n`);
  
  if (items.length > 0) {
    console.log('Contact Details:');
    items.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.contactName || 'Unknown'}`);
      console.log(`   Contact ID: ${item.contactId}`);
      console.log(`   Email: ${item.contactEmail}`);
      console.log(`   Property: ${item.propertyAddress || 'N/A'}`);
      console.log(`   Attempts: ${item.emailAttempts || 0}`);
      console.log(`   Last Sent: ${item.lastEmailSent || 'Never'}`);
    });
  }
}

checkWrongEmails();
