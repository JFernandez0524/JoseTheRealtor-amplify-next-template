#!/usr/bin/env node

// Simple test script to verify the queue population logic
// This simulates what the API route does

console.log('🧪 Testing queue population logic...');

// Mock GHL contact data (based on what we saw from the MCP API)
const mockGhlContacts = [
  {
    id: 'WAbekoUDYs7NFe10SZDa',
    firstName: 'linda',
    lastName: 'fillman (2)',
    phone: '+19088143442',
    email: null,
    additionalEmails: [],
    tags: ['probate', 'absentee', 'app:synced', 'data:skiptraced', 'ai outreach', 'multi-phone-lead']
  },
  {
    id: 'M8GAQ56yegQZW1aGnc3V',
    firstName: 'jessica',
    lastName: 'danso (2)',
    phone: '+17036597148',
    email: null,
    additionalEmails: [],
    tags: ['probate', 'absentee', 'app:synced', 'data:skiptraced', 'ai outreach', 'multi-phone-lead']
  },
  {
    id: 'REGULAR_CONTACT',
    firstName: 'john',
    lastName: 'doe',
    phone: '+15551234567',
    email: 'john@example.com',
    additionalEmails: ['john.doe@gmail.com'],
    tags: ['regular', 'app:synced']
  }
];

console.log(`📊 Total mock contacts: ${mockGhlContacts.length}`);

// Filter for contacts with "ai outreach" tag
const aiOutreachContacts = mockGhlContacts.filter(contact => 
  contact.tags && contact.tags.includes('ai outreach')
);

console.log(`📊 Contacts with "ai outreach" tag: ${aiOutreachContacts.length}`);

// Simulate queue entry creation
let queueEntriesAdded = 0;

for (const contact of aiOutreachContacts) {
  console.log(`\n👤 Processing: ${contact.firstName} ${contact.lastName}`);
  
  // Add SMS queue entry if phone exists
  if (contact.phone) {
    const smsEntry = {
      contactId: contact.id,
      contactMethod: contact.phone,
      channel: 'SMS',
      status: 'PENDING',
      touchNumber: 1,
      nextTouchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log(`  ✅ SMS queue entry: ${contact.phone}`);
    queueEntriesAdded++;
  }
  
  // Add EMAIL queue entries for all email addresses
  const emails = [contact.email, ...(contact.additionalEmails || [])].filter(Boolean);
  for (const email of emails) {
    const emailEntry = {
      contactId: contact.id,
      contactMethod: email,
      channel: 'EMAIL',
      status: 'PENDING',
      touchNumber: 1,
      nextTouchDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log(`  ✅ EMAIL queue entry: ${email}`);
    queueEntriesAdded++;
  }
}

console.log(`\n🎉 Test complete!`);
console.log(`📊 Total contacts: ${mockGhlContacts.length}`);
console.log(`📊 AI outreach contacts: ${aiOutreachContacts.length}`);
console.log(`📊 Queue entries that would be added: ${queueEntriesAdded}`);

// Expected result based on our mock data:
// - 2 contacts with "ai outreach" tag
// - Each has 1 phone number
// - No email addresses
// - Total queue entries: 2 SMS entries = 2 total
