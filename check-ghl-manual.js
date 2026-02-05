/**
 * Check for GHL sync failures using Next.js API route
 */

const https = require('https');

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve(jsonBody);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function checkGhlFailedLeads() {
  try {
    console.log('🔍 Checking for leads marked as "ghl failed" that exist in GHL...\n');
    console.log('⚠️  Make sure your Next.js dev server is running on localhost:3000\n');

    // We'll create a simple API endpoint to get the data
    console.log('📝 Manual verification steps:');
    console.log('1. Go to your dashboard at http://localhost:3000');
    console.log('2. Look for leads without GHL Contact IDs');
    console.log('3. Search for those contacts in GHL by name/email');
    console.log('4. If found, they exist in GHL but local DB shows failed sync');
    
    console.log('\n🔧 To fix sync issues:');
    console.log('1. Note the GHL Contact ID from GHL');
    console.log('2. Update the local database record');
    console.log('3. Change ghlSyncStatus from "FAILED" to "SUCCESS"');

    console.log('\n💡 Alternative approach:');
    console.log('1. Use the GHL MCP tools to search for contacts');
    console.log('2. Compare with your local database');
    console.log('3. Look for contacts with "app:synced" tag in GHL');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkGhlFailedLeads();
