const { generateClient } = require('aws-amplify/data');
const { Amplify } = require('aws-amplify');
const outputs = require('./amplify_outputs.json');

// Configure Amplify
Amplify.configure(outputs);
const client = generateClient();

// GHL MCP functions (only work in MCP environment)
const contacts_getcontacts = async (params) => {
  throw new Error('MCP function not available in Node.js - run with proper MCP environment');
};

// Get all GHL contacts with pagination
async function getAllGHLContacts() {
  console.log('📋 Fetching ALL GHL contacts to find "ai outreach" tagged contacts...');
  
  let allContacts = [];
  let hasMore = true;
  let startAfter = null;
  let startAfterId = null;
  let page = 1;
  
  while (hasMore) {
    console.log(`📄 Fetching page ${page}...`);
    
    try {
      const params = {
        query_locationId: 'mHaAy3ZaUHgrbPyughDG',
        query_limit: 100
      };
      
      if (startAfter) params.query_startAfter = startAfter;
      if (startAfterId) params.query_startAfterId = startAfterId;
      
      const response = await contacts_getcontacts(params);
      
      if (response.success && response.data?.contacts) {
        const contacts = response.data.contacts;
        console.log(`   Found ${contacts.length} contacts on page ${page}`);
        
        // Filter for contacts with "ai outreach" tag
        const taggedContacts = contacts.filter(contact => 
          contact.tags && contact.tags.includes('ai outreach')
        );
        
        console.log(`   ${taggedContacts.length} contacts have "ai outreach" tag`);
        allContacts.push(...taggedContacts);
        
        // Check if there are more pages
        if (contacts.length < 100) {
          hasMore = false;
        } else {
          // Use the last contact's pagination info
          const lastContact = contacts[contacts.length - 1];
          if (lastContact.startAfter) {
            startAfter = lastContact.startAfter[0];
            startAfterId = lastContact.startAfter[1];
          } else {
            hasMore = false;
          }
        }
        
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } else {
        console.log('❌ Failed to fetch contacts:', response);
        hasMore = false;
      }
      
    } catch (error) {
      console.error('❌ Error fetching contacts:', error.message);
      hasMore = false;
    }
  }
  
  console.log(`📊 Total contacts with "ai outreach" tag: ${allContacts.length}`);
  return allContacts;
}

// Check if contact+method+channel already exists in queue
async function isContactInQueue(contactId, contactMethod, channel) {
  try {
    const { data: existingEntries } = await client.models.OutreachQueue.list({
      filter: {
        and: [
          { contactId: { eq: contactId } },
          { contactMethod: { eq: contactMethod } },
          { channel: { eq: channel } }
        ]
      }
    });
    
    return existingEntries.length > 0;
  } catch (error) {
    console.error('Error checking queue:', error);
    return false;
  }
}

// Add contact to outreach queue
async function addToQueue(contact, contactMethod, channel) {
  const queueEntry = {
    contactId: contact.id,
    contactName: contact.contactName || `${contact.firstName} ${contact.lastName}`.trim(),
    contactMethod: contactMethod,
    channel: channel,
    status: 'PENDING',
    touchNumber: 1,
    nextTouchDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  try {
    await client.models.OutreachQueue.create(queueEntry);
    console.log(`✅ Added ${contact.contactName} (${contactMethod}) to ${channel} queue`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to add ${contact.contactName} (${contactMethod}):`, error);
    return false;
  }
}

// Get current queue size
async function getQueueSize() {
  try {
    const { data: queueEntries } = await client.models.OutreachQueue.list();
    return queueEntries.length;
  } catch (error) {
    console.error('Error getting queue size:', error);
    return 0;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting bulk queue population with ALL tagged contacts...');
  
  // Get current queue size
  const initialQueueSize = await getQueueSize();
  console.log(`📊 Current queue size: ${initialQueueSize} contacts`);
  
  // Get all contacts with "ai outreach" tag
  const contacts = await getAllGHLContacts();
  
  if (contacts.length === 0) {
    console.log('❌ No contacts found with "ai outreach" tag');
    return;
  }
  
  console.log(`📋 Processing ${contacts.length} contacts with "ai outreach" tag`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Process each contact
  for (const contact of contacts) {
    // Add SMS entry if phone exists
    if (contact.phone) {
      const alreadyInQueue = await isContactInQueue(contact.id, contact.phone, 'SMS');
      if (!alreadyInQueue) {
        const success = await addToQueue(contact, contact.phone, 'SMS');
        if (success) successCount++;
        else failCount++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`⏭️  Skipped ${contact.contactName} (${contact.phone}) - already in queue`);
        failCount++;
      }
    }
    
    // Add EMAIL entry if email exists
    if (contact.email) {
      const alreadyInQueue = await isContactInQueue(contact.id, contact.email, 'EMAIL');
      if (!alreadyInQueue) {
        const success = await addToQueue(contact, contact.email, 'EMAIL');
        if (success) successCount++;
        else failCount++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`⏭️  Skipped ${contact.contactName} (${contact.email}) - already in queue`);
        failCount++;
      }
    }
  }
  
  // Get final queue size
  const finalQueueSize = await getQueueSize();
  const newEntries = finalQueueSize - initialQueueSize;
  
  console.log('\n📈 Bulk population complete!');
  console.log(`✅ Successfully added: ${successCount} queue entries`);
  console.log(`❌ Failed to add: ${failCount} queue entries`);
  console.log(`📊 Final queue size: ${finalQueueSize} contacts`);
  console.log(`📈 Added ${newEntries} new queue entries`);
}

// Run the script
main().catch(console.error);
