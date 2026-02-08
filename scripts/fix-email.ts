import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

async function fixEmail(contactId: string, newEmail: string, accessToken: string) {
  console.log(`🔧 Fixing email for contact ${contactId}...\n`);

  try {
    // 1. Update email in GHL
    console.log('1️⃣ Updating email in GHL...');
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        email: newEmail,
        tags: ['email:corrected']
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    console.log(`✅ Updated GHL contact with new email: ${newEmail}`);

    // 2. Remove wrong_address and needs_review tags
    console.log('\n2️⃣ Removing error tags from GHL...');
    await axios.delete(
      `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        data: {
          tags: ['email:wrong_address', 'needs_review']
        }
      }
    );
    console.log('✅ Removed error tags');

    // 3. Find queue entry by contactId (scan for it)
    console.log('\n3️⃣ Finding queue entry...');
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: QUEUE_TABLE,
      FilterExpression: 'contactId = :contactId',
      ExpressionAttributeValues: {
        ':contactId': contactId
      }
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('⚠️ No queue entry found for this contact');
      return;
    }

    const queueItem = scanResult.Items[0];
    console.log(`✅ Found queue entry: ${queueItem.id}`);

    // 4. Update queue with new email and reset status to PENDING
    console.log('\n4️⃣ Updating queue with corrected email...');
    await dynamodb.send(new UpdateCommand({
      TableName: QUEUE_TABLE,
      Key: { id: queueItem.id },
      UpdateExpression: 'SET contactEmail = :email, emailStatus = :status, emailAttempts = :attempts, updatedAt = :now',
      ExpressionAttributeValues: {
        ':email': newEmail,
        ':status': 'PENDING',
        ':attempts': 0,
        ':now': new Date().toISOString()
      }
    }));
    console.log('✅ Queue updated - contact will receive emails again');

    console.log('\n✅ Email correction complete!');
    console.log(`   Contact: ${contactId}`);
    console.log(`   New Email: ${newEmail}`);
    console.log(`   Status: Ready for outreach`);

  } catch (error: any) {
    console.error('❌ Error fixing email:', error.response?.data || error.message);
  }
}

// Usage: npx tsx scripts/fix-email.ts <contactId> <newEmail> <accessToken>
const [contactId, newEmail, accessToken] = process.argv.slice(2);

if (!contactId || !newEmail || !accessToken) {
  console.log('Usage: npx tsx scripts/fix-email.ts <contactId> <newEmail> <accessToken>');
  console.log('Example: npx tsx scripts/fix-email.ts abc123 correct@email.com eyJhbGc...');
  process.exit(1);
}

fixEmail(contactId, newEmail, accessToken);
