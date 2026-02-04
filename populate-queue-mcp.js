#!/usr/bin/env node

// This script should be run through Kiro CLI which has MCP access
// It will use the contacts API to find all "ai outreach" tagged contacts
// and add them to the outreach queue

console.log('🚀 Starting queue population via MCP...');
console.log('📋 This script needs to be run through Kiro CLI with MCP access');
console.log('');
console.log('Steps to populate queue:');
console.log('1. Use contacts_getcontacts API to fetch all contacts');
console.log('2. Filter for contacts with "ai outreach" tag');
console.log('3. For each contact, create queue entries for phone/email');
console.log('4. Use appropriate APIs to add to OutreachQueue table');
console.log('');
console.log('❌ This script cannot run directly in Node.js');
console.log('✅ Run through Kiro CLI which has MCP tool access');

process.exit(1);
