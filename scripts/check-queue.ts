import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function checkQueue() {
  console.log('📊 Checking outreach queue...\n');

  const result = await dynamodb.send(new ScanCommand({
    TableName: QUEUE_TABLE
  }));

  const items = result.Items || [];
  
  const smsPending = items.filter(i => i.smsStatus === 'PENDING').length;
  const smsReplied = items.filter(i => i.smsStatus === 'REPLIED').length;
  const smsFailed = items.filter(i => i.smsStatus === 'FAILED').length;
  const smsOptedOut = items.filter(i => i.smsStatus === 'OPTED_OUT').length;
  
  const emailPending = items.filter(i => i.emailStatus === 'PENDING').length;
  const emailReplied = items.filter(i => i.emailStatus === 'REPLIED').length;
  const emailBounced = items.filter(i => i.emailStatus === 'BOUNCED').length;
  const emailFailed = items.filter(i => i.emailStatus === 'FAILED').length;

  console.log(`Total Queue Entries: ${items.length}\n`);
  console.log('SMS Status:');
  console.log(`  PENDING: ${smsPending}`);
  console.log(`  REPLIED: ${smsReplied}`);
  console.log(`  FAILED: ${smsFailed}`);
  console.log(`  OPTED_OUT: ${smsOptedOut}\n`);
  console.log('Email Status:');
  console.log(`  PENDING: ${emailPending}`);
  console.log(`  REPLIED: ${emailReplied}`);
  console.log(`  BOUNCED: ${emailBounced}`);
  console.log(`  FAILED: ${emailFailed}`);
}

checkQueue();
