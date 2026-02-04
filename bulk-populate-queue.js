const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Initialize DynamoDB client
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

// Import GHL MCP functions (adjust import path as needed)
// If using MCP server directly, you'll need to set up the MCP client connection

// Function to get ALL GHL contacts with "ai outreach" tag (with pagination)
async function getAllGHLContacts() {
  try {
    console.log('📞 Fetching ALL GHL contacts with "ai outreach" tag...');
    
    const allContacts = [];
    let hasMore = true;
    let startAfter = null;
    let startAfterId = null;
    let page = 1;
    
    while (hasMore) {
      console.log(`   📄 Fetching page ${page}...`);
      
      const params = {
        query_limit: 100,
        query_locationId: "mHaAy3ZaUHgrbPyughDG",
        query_query: 'ai outreach'
      };
      
      if (startAfter && startAfterId) {
        params.query_startAfter = startAfter;
        params.query_startAfterId = startAfterId;
      }
      
      const response = await contacts_getcontacts(params);
      
      if (!response.success) {
        throw new Error(`GHL API error: ${response.status}`);
      }
      
      const contacts = response.data.contacts || [];
      const meta = response.data.meta || {};
      
      // Transform contacts to our format
      const transformedContacts = contacts.map(contact => ({
        id: contact.id,
        firstName: contact.firstNameRaw || contact.firstName,
        lastName: contact.lastNameRaw || contact.lastName,
        phone: contact.phone,
        email: contact.email,
        additionalEmails: contact.additionalEmails || [],
        tags: contact.tags
      }));
      
      allContacts.push(...transformedContacts);
      
      // Check if there are more pages
      hasMore = !!meta.nextPageUrl;
      startAfter = meta.startAfter;
      startAfterId = meta.startAfterId;
      page++;
      
      console.log(`   ✅ Page ${page - 1}: ${contacts.length} contacts (Total: ${allContacts.length})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Found ${allContacts.length} total contacts with "ai outreach" tag`);
    return allContacts;
  } catch (error) {
    console.error('Error fetching GHL contacts:', error);
    return [];
  }
}

async function addContactToQueue(contact) {
  const results = [];
  
  // Add phone numbers to queue (primary + additional)
  const phones = [contact.phone, ...(contact.additionalPhones || [])].filter(Boolean);
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

    const params = {
      TableName: 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE',
      Item: marshall(queueItem)
    };

    try {
      await dynamodb.send(new PutItemCommand(params));
      console.log(`✓ Added SMS queue for ${contact.firstName} ${contact.lastName} (${phone})`);
      results.push(true);
    } catch (error) {
      console.error(`✗ Failed to add SMS queue for ${contact.firstName} ${contact.lastName}:`, error.message);
      results.push(false);
    }
  }
  
  // Add emails to queue (primary + additional)
  const emails = [contact.email, ...(contact.additionalEmails || [])].filter(Boolean);
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

    const params = {
      TableName: 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE',
      Item: marshall(queueItem)
    };

    try {
      await dynamodb.send(new PutItemCommand(params));
      console.log(`✓ Added EMAIL queue for ${contact.firstName} ${contact.lastName} (${email})`);
      results.push(true);
    } catch (error) {
      console.error(`✗ Failed to add EMAIL queue for ${contact.firstName} ${contact.lastName}:`, error.message);
      results.push(false);
    }
  }
  
  return results.some(r => r); // Return true if at least one succeeded
}

async function checkExistingQueue() {
  const params = {
    TableName: 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE',
    Select: 'COUNT'
  };

  try {
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Count || 0;
  } catch (error) {
    console.error('Error checking queue:', error.message);
    return 0;
  }
}

async function main() {
  console.log('🚀 Starting bulk queue population...');
  
  // Check current queue size
  const currentCount = await checkExistingQueue();
  console.log(`📊 Current queue size: ${currentCount} contacts`);
  
  // Get all GHL contacts with "ai outreach" tag
  console.log('📞 Fetching GHL contacts with "ai outreach" tag...');
  const contacts = await getAllGHLContacts();
  
  if (contacts.length === 0) {
    console.log('⚠️  No contacts found. Make sure to implement GHL MCP calls.');
    console.log('💡 Use the GHL MCP server to:');
    console.log('   1. Search contacts with tag "ai outreach"');
    console.log('   2. Get contact details (phone, email)');
    console.log('   3. Filter out contacts already in queue');
    return;
  }
  
  console.log(`📋 Found ${contacts.length} contacts to process`);
  
  // Add contacts to queue
  let successCount = 0;
  let failCount = 0;
  
  for (const contact of contacts) {
    const success = await addContactToQueue(contact);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Rate limit - 2 seconds between operations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📈 Bulk population complete!');
  console.log(`✅ Successfully added: ${successCount} contacts`);
  console.log(`❌ Failed to add: ${failCount} contacts`);
  
  // Check final queue size
  const finalCount = await checkExistingQueue();
  console.log(`📊 Final queue size: ${finalCount} contacts`);
}

// Run the script
main().catch(console.error);
