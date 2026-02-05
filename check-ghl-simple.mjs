/**
 * Simple script to check for GHL sync failures using your existing utilities
 */

import { fetchLeads } from './app/utils/aws/data/lead.server.js';

async function checkGhlFailedLeads() {
  try {
    console.log('🔍 Checking for leads marked as "ghl failed" that exist in GHL...\n');

    // Get all leads from local database using your existing utility
    const leads = await fetchLeads();

    console.log(`📊 Found ${leads.length} total leads in local database`);

    // Filter leads that have ghlSyncStatus as "FAILED" or missing ghlContactId
    const failedLeads = leads.filter(lead => {
      return (
        lead.ghlSyncStatus === 'FAILED' ||
        !lead.ghlContactId ||
        lead.ghlContactId === '' ||
        lead.ghlContactId === null
      );
    });

    console.log(`❌ Found ${failedLeads.length} leads marked as failed/not synced`);

    if (failedLeads.length === 0) {
      console.log('✅ No failed leads found!');
      return;
    }

    // Display the failed leads for manual verification
    console.log('\n📋 Failed leads that need verification:');
    console.log('=' .repeat(80));

    failedLeads.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.ownerFirstName} ${lead.ownerLastName}`);
      console.log(`   Address: ${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`);
      console.log(`   Emails: ${lead.emails ? lead.emails.join(', ') : 'N/A'}`);
      console.log(`   Phones: ${lead.phones ? lead.phones.join(', ') : 'N/A'}`);
      console.log(`   GHL Contact ID: ${lead.ghlContactId || 'NULL'}`);
      console.log(`   GHL Sync Status: ${lead.ghlSyncStatus || 'N/A'}`);
      console.log(`   Lead Type: ${lead.type || 'N/A'}`);
      console.log(`   Lead ID: ${lead.id}`);
      console.log('-'.repeat(40));
    });

    console.log('\n🔧 To verify these leads exist in GHL:');
    console.log('1. Search GHL contacts by name or email');
    console.log('2. Check if they have "app:synced" tag');
    console.log('3. If found, update local database with correct GHL contact ID');

    // Create a simple list for manual checking
    console.log('\n📝 Quick search list (copy/paste into GHL search):');
    failedLeads.slice(0, 10).forEach((lead, index) => {
      const email = lead.emails && lead.emails.length > 0 ? lead.emails[0] : '';
      const name = `${lead.ownerFirstName} ${lead.ownerLastName}`;
      console.log(`${index + 1}. ${name} ${email ? `(${email})` : ''}`);
    });

    if (failedLeads.length > 10) {
      console.log(`... and ${failedLeads.length - 10} more`);
    }

  } catch (error) {
    console.error('❌ Error checking failed leads:', error);
  }
}

// Run the check
checkGhlFailedLeads();
