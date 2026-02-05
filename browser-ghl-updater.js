/**
 * Browser console script to update GHL sync status
 * 
 * Usage:
 * 1. Go to your dashboard (localhost:3000)
 * 2. Open browser console (F12)
 * 3. Paste this script
 * 4. Call: updateGhlStatus('LEAD_ID', 'SUCCESS', 'GHL_CONTACT_ID')
 */

async function updateGhlStatus(leadId, status, ghlContactId = null) {
  try {
    const response = await fetch('/api/update-ghl-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, status, ghlContactId })
    });
    
    const result = await response.json();
    console.log(result.success ? '✅' : '❌', result.message || result.error);
    return result;
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

// Examples:
// updateGhlStatus('lead-123', 'SUCCESS', 'ghl-contact-456')
// updateGhlStatus('lead-123', 'FAILED')

console.log('📝 GHL Status Updater loaded!');
console.log('Usage: updateGhlStatus(leadId, status, ghlContactId)');
console.log('Status options: SUCCESS, FAILED, PENDING, SKIPPED');
