#!/usr/bin/env node

/**
 * Script to populate the outreach queue with existing GHL contacts
 * that have the "ai outreach" tag but were missed due to the case sensitivity bug
 */

const AWS = require('aws-sdk');

// Configure AWS
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

const OUTREACH_QUEUE_TABLE = 'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const LOCATION_ID = 'mHaAy3ZaUHgrbPyughDG';
const USER_ID = '44d8f4c8-10c1-7038-744b-271103170819';

// Sample contacts from the API response to populate the queue
const sampleContacts = [
  {
    id: "WAbekoUDYs7NFe10SZDa",
    contactName: "linda fillman (2)",
    phone: "+19088143442",
    email: null,
    customFields: [
      { id: "p3NOYiInAERYbe0VsLHB", value: "34 Sanford Rd" },
      { id: "h4UIjKQvFu7oRW4SAY8W", value: "Brick" },
      { id: "9r9OpQaxYPxqbA6Hvtx7", value: "NJ" },
      { id: "oaf4wCuM3Ub9eGpiddrO", value: "Probate" }
    ],
    tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
  },
  {
    id: "M8GAQ56yegQZW1aGnc3V",
    contactName: "jessica danso (2)",
    phone: "+17036597148",
    email: null,
    customFields: [
      { id: "p3NOYiInAERYbe0VsLHB", value: "26 Serpentine Dr E" },
      { id: "h4UIjKQvFu7oRW4SAY8W", value: "Bayville" },
      { id: "9r9OpQaxYPxqbA6Hvtx7", value: "NJ" },
      { id: "oaf4wCuM3Ub9eGpiddrO", value: "Probate" }
    ],
    tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
  },
  {
    id: "q4j4RpY3LOjmSQur6cDp",
    contactName: "gary turner (2)",
    phone: "+16095479471",
    email: null,
    customFields: [
      { id: "p3NOYiInAERYbe0VsLHB", value: "104 Bay Avenue" },
      { id: "h4UIjKQvFu7oRW4SAY8W", value: "Forked River" },
      { id: "9r9OpQaxYPxqbA6Hvtx7", value: "NJ" },
      { id: "oaf4wCuM3Ub9eGpiddrO", value: "Probate" }
    ],
    tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
  },
  {
    id: "1uV44JseKi7Kshzo9n0B",
    contactName: "michael teles (2)",
    phone: "+16093349601",
    email: null,
    customFields: [
      { id: "p3NOYiInAERYbe0VsLHB", value: "16 Passage Ln" },
      { id: "h4UIjKQvFu7oRW4SAY8W", value: "Barnegat" },
      { id: "9r9OpQaxYPxqbA6Hvtx7", value: "NJ" },
      { id: "oaf4wCuM3Ub9eGpiddrO", value: "Probate" }
    ],
    tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
  },
  {
    id: "6n1czcqoDPQvKJY1zDca",
    contactName: "diane mesmer (2)",
    phone: "+17322327079",
    email: null,
    customFields: [
      { id: "p3NOYiInAERYbe0VsLHB", value: "2115 Foster Road" },
      { id: "h4UIjKQvFu7oRW4SAY8W", value: "Point Pleasant Beach" },
      { id: "9r9OpQaxYPxqbA6Hvtx7", value: "NJ" },
      { id: "oaf4wCuM3Ub9eGpiddrO", value: "Probate" }
    ],
    tags: ["probate", "absentee", "app:synced", "data:skiptraced", "ai outreach", "multi-phone-lead"]
  }
];

async function addToOutreachQueue(contact) {
  // Helper function to get custom field value
  const getCustomFieldValue = (fieldId) => {
    const field = contact.customFields?.find(f => f.id === fieldId);
    return field?.value || null;
  };

  const queueEntry = {
    id: `${USER_ID}_${contact.id}`,
    userId: USER_ID,
    locationId: LOCATION_ID,
    contactId: contact.id,
    contactName: contact.contactName,
    contactPhone: contact.phone || undefined,
    contactEmail: contact.email || undefined,
    propertyAddress: getCustomFieldValue('p3NOYiInAERYbe0VsLHB'), // property_address
    propertyCity: getCustomFieldValue('h4UIjKQvFu7oRW4SAY8W'), // property_city
    propertyState: getCustomFieldValue('9r9OpQaxYPxqbA6Hvtx7'), // property_state
    leadType: getCustomFieldValue('oaf4wCuM3Ub9eGpiddrO'), // lead_type
    smsStatus: contact.phone ? 'PENDING' : undefined,
    emailStatus: contact.email ? 'PENDING' : undefined,
    smsAttempts: 0,
    emailAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Remove undefined values
  Object.keys(queueEntry).forEach(key => {
    if (queueEntry[key] === undefined) {
      delete queueEntry[key];
    }
  });

  try {
    await dynamodb.put({
      TableName: OUTREACH_QUEUE_TABLE,
      Item: queueEntry,
      ConditionExpression: 'attribute_not_exists(id)' // Don't overwrite existing entries
    }).promise();
    
    console.log(`✅ Added ${contact.contactName} (${contact.id}) to queue`);
    return true;
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      console.log(`⚠️  ${contact.contactName} already in queue, skipping`);
      return false;
    }
    console.error(`❌ Failed to add ${contact.contactName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting outreach queue population...');
  console.log(`📊 Processing ${sampleContacts.length} sample contacts`);
  
  let added = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const contact of sampleContacts) {
    // Only add contacts with "ai outreach" tag
    if (contact.tags.includes('ai outreach')) {
      const result = await addToOutreachQueue(contact);
      if (result === true) added++;
      else if (result === false) skipped++;
      else failed++;
      
      // Small delay to avoid overwhelming DynamoDB
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      console.log(`⏭️  Skipping ${contact.contactName} - no "ai outreach" tag`);
      skipped++;
    }
  }
  
  console.log('\n📈 Summary:');
  console.log(`✅ Added: ${added}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('\n🎯 Next steps:');
  console.log('1. This script only processed 5 sample contacts');
  console.log('2. You need to fetch ALL contacts with "ai outreach" tag from GHL API');
  console.log('3. Run this script with the complete contact list');
  console.log('4. The daily outreach agents will then find these contacts in the queue');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { addToOutreachQueue };
