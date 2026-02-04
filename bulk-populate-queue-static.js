const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

// Option 2: Static contact list from your previous GHL query
async function getAllGHLContacts() {
  return [
    {
      id: "WAbekoUDYs7NFe10SZDa",
      firstName: "Linda",
      lastName: "Fillman",
      phone: "+19088143442",
      email: null,
      additionalEmails: [],
      tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
    },
    {
      id: "M8GAQ56yegQZW1aGnc3V",
      firstName: "Jessica", 
      lastName: "Danso",
      phone: "+17036597148",
      email: null,
      additionalEmails: [],
      tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
    }
    // TODO: Add the remaining ~98 contacts from your GHL response here
    // Copy them from the JSON response you showed me earlier
  ];
}

async function addContactToQueue(contact) {
  const results = [];
  
  // Add phone numbers to queue
  const phones = [contact.phone].filter(Boolean);
  for (const phone of phones) {
    const queueItem = {
      id: `${contact.id}_phone_${phone.replace(/\D/g, '')}_${Date.now()}`,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      phone: phone,
      email: null,
      channel: 'SMS',
      status: 'PENDING',
      touchNumber: 1,
      nextTouchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await dynamodb.send(new PutItemCommand({
        TableName: 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE',
        Item: marshall(queueItem)
      }));
      console.log(`✓ Added SMS queue for ${contact.firstName} ${contact.lastName}`);
      results.push(true);
    } catch (error) {
      console.error(`✗ Failed SMS for ${contact.firstName}:`, error.message);
      results.push(false);
    }
  }
  
  // Add emails to queue
  const emails = [contact.email, ...contact.additionalEmails].filter(Boolean);
  for (const email of emails) {
    const queueItem = {
      id: `${contact.id}_email_${email.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      phone: null,
      email: email,
      channel: 'EMAIL',
      status: 'PENDING',
      touchNumber: 1,
      nextTouchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await dynamodb.send(new PutItemCommand({
        TableName: 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE',
        Item: marshall(queueItem)
      }));
      console.log(`✓ Added EMAIL queue for ${contact.firstName} ${contact.lastName}`);
      results.push(true);
    } catch (error) {
      console.error(`✗ Failed EMAIL for ${contact.firstName}:`, error.message);
      results.push(false);
    }
  }
  
  return results.some(r => r);
}

async function main() {
  console.log('🚀 Starting bulk queue population...');
  
  const contacts = await getAllGHLContacts();
  console.log(`📋 Found ${contacts.length} contacts to process`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const contact of contacts) {
    const success = await addContactToQueue(contact);
    if (success) successCount++;
    else failCount++;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`✅ Success: ${successCount}, ❌ Failed: ${failCount}`);
}

main().catch(console.error);
