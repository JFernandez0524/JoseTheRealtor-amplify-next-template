#!/usr/bin/env node

/**
 * Command line script to update GHL sync status
 * Usage: node update-ghl-status.js LEAD_ID STATUS [GHL_CONTACT_ID]
 */

const leadId = process.argv[2];
const status = process.argv[3];
const ghlContactId = process.argv[4];

if (!leadId || !status) {
  console.log('Usage: node update-ghl-status.js LEAD_ID STATUS [GHL_CONTACT_ID]');
  console.log('Status options: SUCCESS, FAILED, PENDING, SKIPPED');
  console.log('Example: node update-ghl-status.js abc123 SUCCESS ghl456');
  process.exit(1);
}

async function updateStatus() {
  try {
    const response = await fetch('http://localhost:3000/api/update-ghl-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, status, ghlContactId })
    });
    
    const result = await response.json();
    console.log(result.success ? '✅' : '❌', result.message || result.error);
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

updateStatus();
