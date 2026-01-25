/**
 * Quick test script for kvCORE API
 * Run: npx tsx test-kvcore.ts
 */

import 'dotenv/config'; // Load .env.local
import { getContacts, createContact, addSearchAlert } from './app/utils/kvcore.server.js';

async function testKvCoreAPI() {
  console.log('🧪 Testing kvCORE API...\n');

  // Test 1: Get contacts
  console.log('Test 1: Fetching contacts...');
  const contacts = await getContacts({ perPage: 5 });
  if (contacts) {
    console.log(`✅ Success! Found ${contacts.total} contacts`);
    if (contacts.data[0]) {
      console.log('First contact:', {
        id: contacts.data[0].id,
        name: contacts.data[0].name,
        email: contacts.data[0].email
      });
    }
  } else {
    console.log('❌ Failed to fetch contacts');
    console.log('Check that KVCORE_API_KEY is set in .env.local');
  }

  console.log('\n---\n');

  // Test 2: Create a test contact
  console.log('Test 2: Creating test contact...');
  const newContact = await createContact({
    firstName: 'Test',
    lastName: 'Buyer',
    email: 'test@example.com',
    phone: '+1234567890',
    dealType: 'buyer',
    source: 'API Test',
    notes: 'Test contact from API'
  });
  
  if (newContact) {
    console.log('✅ Success! Contact created:', newContact.id);
    
    // Test 3: Add saved search to contact
    console.log('\nTest 3: Adding saved search...');
    const searchAlert = await addSearchAlert(newContact.id, {
      types: ['Single Family', 'Condo'],
      beds: 3,
      baths: 2,
      minPrice: 300000,
      maxPrice: 500000,
      areas: [
        { type: 'city', name: 'Miami' }
      ],
      frequency: 'daily'
    });
    
    if (searchAlert) {
      console.log('✅ Success! Saved search created');
    } else {
      console.log('❌ Failed to create saved search');
    }
  } else {
    console.log('❌ Failed to create contact');
  }

  console.log('\n✅ kvCORE API test complete!');
}

testKvCoreAPI().catch(console.error);
