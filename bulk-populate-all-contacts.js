const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// DynamoDB configuration
const TABLE_NAME = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// All contacts with "ai outreach" tag (from your GHL data)
const ALL_CONTACTS = [
  {
    id: "WAbekoUDYs7NFe10SZDa",
    firstName: "Linda",
    lastName: "Fillman (2)",
    phone: "+19088143442",
    email: null
  },
  {
    id: "M8GAQ56yegQZW1aGnc3V",
    firstName: "Jessica",
    lastName: "Danso (2)",
    phone: "+17036597148",
    email: null
  },
  {
    id: "q4j4RpY3LOjmSQur6cDp",
    firstName: "Gary",
    lastName: "Turner (2)",
    phone: "+16095479471",
    email: null
  },
  {
    id: "1uV44JseKi7Kshzo9n0B",
    firstName: "Michael",
    lastName: "Teles (2)",
    phone: "+16093349601",
    email: null
  },
  {
    id: "6n1czcqoDPQvKJY1zDca",
    firstName: "Diane",
    lastName: "Mesmer (2)",
    phone: "+17322327079",
    email: null
  },
  {
    id: "EOKECUZlPtcJV6gLbtph",
    firstName: "Christopher",
    lastName: "Morici (2)",
    phone: "+19739867566",
    email: null
  },
  {
    id: "hStsotLDONtdfds8CZ4I",
    firstName: "Robin",
    lastName: "Matt (2)",
    phone: "+19172082042",
    email: null
  },
  {
    id: "Zfh7a7eTmmPFdsJcQLUf",
    firstName: "Anthony",
    lastName: "Montoya (2)",
    phone: "+17328740850",
    email: null
  },
  {
    id: "YLagVnrFRUinoPDLpmiw",
    firstName: "John",
    lastName: "Merinsky (2)",
    phone: "+19088641097",
    email: null
  },
  {
    id: "pNln2VYKuR2RQsbA1S93",
    firstName: "Richard",
    lastName: "Montalbano",
    phone: "+19176809693",
    email: "cheemonte@gmail.com"
  },
  {
    id: "9kCOOtBPxSwyswUnynsE",
    firstName: "Henry",
    lastName: "Fisher raymond",
    phone: "+14153504640",
    email: "jason4hope@aol.com"
  },
  {
    id: "RgIBicLpnz23uZpr1NfN",
    firstName: "Dianne",
    lastName: "Lungari",
    phone: "+17326746604",
    email: "lungari64@gmail.com"
  },
  {
    id: "i2gsyLKz7aEVbyurOKyj",
    firstName: "Shawn",
    lastName: "Thomas",
    phone: "+17326193220",
    email: null
  },
  {
    id: "13v3fysEoUdS2DbufIL0",
    firstName: "David",
    lastName: "Mitchel",
    phone: "+17328127041",
    email: "dtmitchell99@gmail.com"
  },
  {
    id: "qqddXkjo3WLBlRj6jPmq",
    firstName: "Joanna",
    lastName: "Scheier",
    phone: "+16465059278",
    email: "7worldtrade@gmail.com"
  },
  {
    id: "1vVlYoVqjHWFNXvVIAJq",
    firstName: "Frank",
    lastName: "Demaria",
    phone: null,
    email: "cassidyw@msn.com"
  },
  {
    id: "MPuvlqX79KtWcy8HOCah",
    firstName: "John",
    lastName: "Torry",
    phone: null,
    email: "sjtorry@gmail.com"
  },
  {
    id: "mrYHYQheAcRUaFKYPDS3",
    firstName: "Donna",
    lastName: "Winkowski",
    phone: null,
    email: "winkowskinicole@gmail.com"
  },
  {
    id: "Cxf6nUhFhxQFeZ07an2V",
    firstName: "Feher",
    lastName: "Feher",
    phone: null,
    email: "rfeher18@aol.com"
  },
  {
    id: "ZMJI06BZ97uk3cwYiWPe",
    firstName: "Linda",
    lastName: "Fillman",
    phone: "+19088142442",
    email: "trangels49@comcast.net"
  }
];

// Calculate next touch date
function calculateNextTouchDate(touchNumber) {
  const now = new Date();
  const daysToAdd = touchNumber === 1 ? 0 : 4 * (touchNumber - 1);
  const nextDate = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
  return nextDate.toISOString();
}

// Check if contact already exists in queue
async function isContactInQueue(contactId, contactMethod, channel) {
  try {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'contactId = :contactId AND contactMethod = :contactMethod AND channel = :channel',
      ExpressionAttributeValues: {
        ':contactId': contactId,
        ':contactMethod': contactMethod,
        ':channel': channel
      }
    };
    
    const result = await docClient.send(new ScanCommand(params));
    return result.Items && result.Items.length > 0;
  } catch (error) {
    console.error('Error checking queue:', error);
    return false;
  }
}

// Add contact to queue
async function addContactToQueue(contact, contactMethod, channel) {
  const contactName = `${contact.firstName} ${contact.lastName}`.trim();
  
  // Check if already in queue
  const exists = await isContactInQueue(contact.id, contactMethod, channel);
  if (exists) {
    console.log(`⏭️  Skipped ${contactName} (${contactMethod}) - already in queue`);
    return false;
  }
  
  const queueItem = {
    id: `${contact.id}_${contactMethod}_${channel}`,
    contactId: contact.id,
    contactName: contactName,
    contactMethod: contactMethod,
    channel: channel,
    status: 'PENDING',
    touchNumber: 1,
    nextTouchDate: calculateNextTouchDate(1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: queueItem
    }));
    
    console.log(`✓ Added ${channel} queue for ${contactName} (${contactMethod})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to add ${contactName} (${contactMethod}):`, error.message);
    return false;
  }
}

// Get current queue size
async function getQueueSize() {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      Select: 'COUNT'
    }));
    return result.Count || 0;
  } catch (error) {
    console.error('Error getting queue size:', error);
    return 0;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting bulk queue population with ALL contacts...');
  
  const initialQueueSize = await getQueueSize();
  console.log(`📊 Current queue size: ${initialQueueSize} contacts`);
  
  console.log(`📋 Processing ${ALL_CONTACTS.length} contacts with "ai outreach" tag`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const contact of ALL_CONTACTS) {
    // Add SMS queue entry if phone exists
    if (contact.phone) {
      const success = await addContactToQueue(contact, contact.phone, 'SMS');
      if (success) successCount++;
      else failCount++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Add EMAIL queue entry if email exists
    if (contact.email) {
      const success = await addContactToQueue(contact, contact.email, 'EMAIL');
      if (success) successCount++;
      else failCount++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const finalQueueSize = await getQueueSize();
  
  console.log('\n📈 Bulk population complete!');
  console.log(`✅ Successfully added: ${successCount} queue entries`);
  console.log(`❌ Failed to add: ${failCount} queue entries`);
  console.log(`📊 Final queue size: ${finalQueueSize} contacts`);
  console.log(`📈 Added ${finalQueueSize - initialQueueSize} new queue entries`);
}

// Run the script
main().catch(console.error);
