#!/usr/bin/env node

/**
 * Script to check leads marked as "ghl failed" in local database 
 * that actually exist in GoHighLevel
 */

const { generateClient } = require('aws-amplify/data');
const { Amplify } = require('aws-amplify');
const outputs = require('./amplify_outputs.json');

// Configure Amplify
Amplify.configure(outputs);
const client = generateClient();

async function checkGhlFailedLeads() {
  try {
    console.log('🔍 Checking for leads marked as "ghl failed" that exist in GHL...\n');

    // Get all leads from local database
    const { data: leads } = await client.models.PropertyLead.list({
      limit: 1000 // Adjust as needed
    });

    console.log(`📊 Found ${leads.length} total leads in local database`);

    // Filter leads that have ghlSyncStatus as "FAILED" or missing ghlContactId
    const failedLeads = leads.filter(lead => {
      // Check various possible failure indicators
      return (
        lead.ghlSyncStatus === 'FAILED' ||
        lead.ghlContactId === null ||
        lead.ghlContactId === '' ||
        lead.ghlContactId === undefined ||
        (lead.notes && Array.isArray(lead.notes) && 
         lead.notes.some(note => note.text && note.text.toLowerCase().includes('ghl failed')))
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

    console.log('\n🔧 Next steps:');
    console.log('1. Manually search for these contacts in GHL using the contact names/emails');
    console.log('2. If found, note their GHL contact IDs');
    console.log('3. Update the local database records with the correct GHL contact IDs');
    console.log('4. Change ghlSyncStatus from "FAILED" to "SUCCESS"');

    // Export to CSV for easier manual checking
    const csv = [
      'Lead ID,Owner Name,Emails,Phones,Address,Type,GHL Contact ID,GHL Sync Status'
    ];

    failedLeads.forEach(lead => {
      const row = [
        lead.id,
        `"${lead.ownerFirstName} ${lead.ownerLastName}"`,
        lead.emails ? lead.emails.join('; ') : '',
        lead.phones ? lead.phones.join('; ') : '',
        `"${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}"`,
        lead.type || '',
        lead.ghlContactId || '',
        lead.ghlSyncStatus || ''
      ].join(',');
      csv.push(row);
    });

    const fs = require('fs');
    fs.writeFileSync('./ghl-failed-leads.csv', csv.join('\n'));
    console.log('\n📄 Exported failed leads to: ./ghl-failed-leads.csv');

  } catch (error) {
    console.error('❌ Error checking failed leads:', error);
  }
}

// Run the check
checkGhlFailedLeads();
