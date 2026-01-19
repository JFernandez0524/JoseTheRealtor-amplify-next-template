/**
 * ============================================================================
 * BULK EMAIL CAMPAIGN HANDLER
 * ============================================================================
 * 
 * PURPOSE:
 * Sends automated prospecting emails to all synced GHL contacts who haven't
 * been contacted yet. This is a one-time bulk operation triggered manually
 * from the dashboard.
 * 
 * ELIGIBILITY CRITERIA:
 * - Contact has tag: "app:synced" (synced from our platform)
 * - email_attempt_counter = 0 (never emailed before)
 * - Has valid email address
 * - Not marked DND (Do Not Disturb)
 * - No "email:bounced" or "email:replied" tags
 * 
 * EMAIL CONTENT:
 * - Personalized with contact's first name
 * - Includes property address and details
 * - Shows estimated property value (Zestimate)
 * - Presents cash offer (70% of Zestimate)
 * - Offers two options: quick cash sale or full market listing
 * 
 * RATE LIMITING:
 * - 2 seconds between each email to prevent API throttling
 * - Sends to all email addresses on contact (primary + email2 + email3)
 * 
 * TRACKING:
 * - Updates email_attempt_counter to 1 after sending
 * - Records last_email_date for future reference
 * 
 * INVOCATION:
 * - Triggered from dashboard "Start Email Campaign" button
 * - Requires user to have active GHL integration
 * - Returns success/fail counts for reporting
 * 
 * CLOUDWATCH LOGS:
 * - Filter by [BULK_EMAIL] to see all campaign activity
 * - Logs each email sent with recipient address
 * - Captures errors with full stack traces
 * ============================================================================
 */

import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';

// GHL Custom Field IDs for email tracking
const EMAIL_FIELD_IDS = {
  email_attempt_counter: 'wWlrXoXeMXcM6kUexf2L', // Tracks number of emails sent
  last_email_date: '3xOBr4GvgRc22kBRNYCE',       // Last email send date
};
export const handler = async (event: { userId: string }) => {
  console.log('📧 [BULK_EMAIL] Starting bulk email campaign');
  console.log('📧 [BULK_EMAIL] Event:', JSON.stringify(event));
  console.log('📧 [BULK_EMAIL] Environment:', {
    hasGhlClientId: !!process.env.GHL_CLIENT_ID,
    hasGhlClientSecret: !!process.env.GHL_CLIENT_SECRET,
    hasTableName: !!process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
    region: process.env.AWS_REGION
  });
  
  const { userId } = event;
  console.log('📧 [BULK_EMAIL] User ID:', userId);
  
  try {
    // Get user's GHL token and locationId
    console.log('📧 [BULK_EMAIL] Fetching GHL token...');
    const ghlData = await getValidGhlToken(userId);
    if (!ghlData) {
      console.error('❌ [BULK_EMAIL] GHL integration not found for user:', userId);
      throw new Error('GHL integration not found');
    }
    
    console.log('✅ [BULK_EMAIL] GHL token retrieved, locationId:', ghlData.locationId);
    const { token: accessToken, locationId } = ghlData;
    
    // Fetch all contacts with app:synced tag
    console.log('📧 [BULK_EMAIL] Fetching eligible contacts...');
    const contacts = await fetchEligibleContacts(accessToken, locationId);
    console.log(`✅ [BULK_EMAIL] Found ${contacts.length} eligible contacts`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Send email to each contact
    for (const contact of contacts) {
      try {
        console.log(`📧 [BULK_EMAIL] Sending to: ${contact.email}`);
        await sendProspectingEmail(accessToken, contact);
        successCount++;
        console.log(`✅ [BULK_EMAIL] Sent to: ${contact.email}`);
        
        // Rate limiting: 2 seconds between emails
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`❌ [BULK_EMAIL] Failed to email ${contact.email}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`✅ [BULK_EMAIL] Campaign complete: ${successCount} sent, ${failCount} failed`);
    
    return {
      statusCode: 200,
      success: true,
      totalContacts: contacts.length,
      successCount,
      failCount
    };
    
  } catch (error: any) {
    console.error('❌ [BULK_EMAIL] Campaign error:', error.message);
    console.error('❌ [BULK_EMAIL] Stack:', error.stack);
    return {
      statusCode: 500,
      success: false,
      error: error.message
    };
  }
};

/**
 * ============================================================================
 * FETCH ELIGIBLE CONTACTS
 * ============================================================================
 * 
 * Retrieves all GHL contacts that meet the criteria for email outreach.
 * Uses pagination to handle large contact lists (100 contacts per page).
 * 
 * FILTERS APPLIED:
 * 1. Has "app:synced" tag (contact came from our platform)
 * 2. email_attempt_counter = 0 (never emailed)
 * 3. Has valid email address
 * 4. Not on DND list
 * 5. No "email:bounced" tag (previous email didn't bounce)
 * 6. No "email:replied" tag (already engaged)
 * 
 * @param accessToken - GHL API access token
 * @param locationId - GHL location ID
 * @returns Array of eligible contact objects
 */
async function fetchEligibleContacts(accessToken: string, locationId: string): Promise<any[]> {
  const eligibleContacts: any[] = [];
  let nextCursor: string | undefined;
  
  do {
    const params: any = {
      locationId,
      limit: 100,
    };
    
    if (nextCursor) {
      params.cursor = nextCursor;
    }
    
    const response = await axios.get('https://services.leadconnectorhq.com/contacts/', {
      params,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28'
      }
    });
    
    const contacts = response.data.contacts || [];
    
    // Filter for eligible contacts
    for (const contact of contacts) {
      const hasAppSyncedTag = contact.tags?.some((tag: string) => 
        tag.toLowerCase().includes('app:synced')
      );
      
      const hasBouncedTag = contact.tags?.some((tag: string) => 
        tag.toLowerCase().includes('email:bounced')
      );
      
      const hasRepliedTag = contact.tags?.some((tag: string) => 
        tag.toLowerCase().includes('email:replied')
      );
      
      const emailCounter = contact.customFields?.find((f: any) => 
        f.id === EMAIL_FIELD_IDS.email_attempt_counter
      )?.value || '0';
      
      const hasEmail = contact.email && contact.email.length > 0;
      const notDND = !contact.dnd && contact.dndSettings?.all?.status !== 'active';
      
      // Skip if bounced, replied, or already emailed
      if (hasAppSyncedTag && emailCounter === '0' && hasEmail && notDND && !hasBouncedTag && !hasRepliedTag) {
        eligibleContacts.push(contact);
      }
    }
    
    nextCursor = response.data.meta?.nextCursor;
    
  } while (nextCursor);
  
  return eligibleContacts;
}

/**
 * ============================================================================
 * SEND PROSPECTING EMAIL
 * ============================================================================
 * 
 * Sends personalized prospecting email to a contact with property details
 * and offer information. Sends to all email addresses on the contact record.
 * 
 * EMAIL STRUCTURE:
 * - Subject: "Interested in Your Property at [Address]"
 * - Personalized greeting with first name
 * - Property address and type (preforeclosure/probate)
 * - Estimated property value from Zillow
 * - Cash offer amount (70% of Zestimate)
 * - Two options: quick cash sale or full market listing
 * - Professional signature
 * 
 * MULTI-EMAIL SUPPORT:
 * - Sends to primary email + email2 + email3 if available
 * - Increases chance of contact reaching the owner
 * 
 * TRACKING:
 * - Updates email_attempt_counter to 1
 * - Records last_email_date
 * - Prevents duplicate emails in future campaigns
 * 
 * @param accessToken - GHL API access token
 * @param contact - GHL contact object with custom fields
 */
async function sendProspectingEmail(accessToken: string, contact: any): Promise<void> {
  // Extract property data from custom fields
  const getCustomField = (id: string) => 
    contact.customFields?.find((f: any) => f.id === id)?.value || '';
  
  const propertyAddress = getCustomField('p3NOYiInAERYbe0VsLHB');
  const propertyCity = getCustomField('h4UIjKQvFu7oRW4SAY8W');
  const propertyState = getCustomField('9r9OpQaxYPxqbA6Hvtx7');
  const propertyZip = getCustomField('hgbjsTVwcyID7umdhm2o');
  const zestimate = parseInt(getCustomField('7wIe1cRbZYXUnc3WOVb2')) || 0;
  const cashOffer = parseInt(getCustomField('sM3hEOHCJFoPyWhj1Vc8')) || 0;
  const leadType = getCustomField('oaf4wCuM3Ub9eGpiddrO')?.toLowerCase() || 'property';
  
  // Get all email addresses
  const email2 = getCustomField('JY5nf3NzRwfCGvN5u00E');
  const email3 = getCustomField('1oy6TLKItn5RkebjI7kD');
  const emails = [contact.email, email2, email3].filter(e => e && e.length > 0);
  
  // Get user's email from location settings
  const locationResponse = await axios.get(
    `https://services.leadconnectorhq.com/locations/${contact.locationId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-07-28'
      }
    }
  );
  
  const fromEmail = locationResponse.data.location?.email || 'jose.fernandez@josetherealtor.com';
  
  const fullAddress = `${propertyAddress}, ${propertyCity}, ${propertyState} ${propertyZip}`;
  
  const subject = `Interested in Your Property at ${propertyAddress}`;
  const html = `
    <p>Hi ${contact.firstName || 'there'},</p>
    
    <p>I noticed your ${leadType} property at <strong>${fullAddress}</strong> and wanted to reach out.</p>
    
    <p>We specialize in helping property owners in situations like yours. Based on current market data:</p>
    <ul>
      <li><strong>Estimated Property Value:</strong> $${zestimate.toLocaleString()}</li>
      <li><strong>Our Cash Offer:</strong> $${cashOffer.toLocaleString()} (as-is condition)</li>
    </ul>
    
    <p>We can close quickly with no repairs needed, or we can help you list it for full market value if you prefer.</p>
    
    <p>Would you be open to a quick conversation about your options?</p>
    
    <p>Best regards,<br>
    Jose Fernandez<br>
    RE/MAX Agent</p>
  `;
  
  // Send email to each address
  for (const email of emails) {
    await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'Email',
        contactId: contact.id,
        emailFrom: fromEmail,
        subject: subject,
        html: html
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log(`✅ Sent email to ${email} from ${fromEmail}`);
  }
  
  // Update tracking fields
  await axios.put(
    `https://services.leadconnectorhq.com/contacts/${contact.id}`,
    {
      customFields: [
        { id: EMAIL_FIELD_IDS.email_attempt_counter, value: '1' },
        { id: EMAIL_FIELD_IDS.last_email_date, value: new Date().toISOString().split('T')[0] }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    }
  );
}
