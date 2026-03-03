/**
 * Find your GHL User ID
 * 
 * Run with: npx tsx find-ghl-user-id.ts
 */

import axios from 'axios';

const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'mHaAy3ZaUHgrbPyughDG';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-a975757c-04a0-446d-a23b-3ef1050ae32a';

async function findUserId() {
  try {
    console.log('🔍 Fetching users from GHL location...\n');
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/users/`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
        },
        params: {
          locationId: GHL_LOCATION_ID,
        }
      }
    );
    
    const users = response.data.users || [];
    
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach((user: any, index: number) => {
      console.log(`${index + 1}. ${user.name || user.firstName + ' ' + user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Role: ${user.role || 'N/A'}`);
      console.log('');
    });
    
    console.log('📋 Copy the User ID for YOUR account and add it to .env.local:');
    console.log('   GHL_USER_ID=<your_user_id>');
    
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

findUserId();
