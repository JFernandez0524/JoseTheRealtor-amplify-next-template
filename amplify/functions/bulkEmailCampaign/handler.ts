import axios from 'axios';
import { getValidGhlToken } from '../shared/ghlTokenManager';

const EMAIL_FIELD_IDS = {
  email_attempt_counter: 'wWlrXoXeMXcM6kUexf2L',
  last_email_date: '3xOBr4GvgRc22kBRNYCE',
};

/**
 * BULK EMAIL CAMPAIGN HANDLER
 * 
 * Sends initial prospecting emails to all existing GHL contacts that:
 * - Have tag: app:synced
 * - Have email_attempt_counter = 0 or empty
 * - Have valid email address
 * - Are not marked DND
 * 
 * Triggered manually from dashboard button.
 */
export const handler = async (event: { userId: string }) => {
  console.log('📧 Starting bulk email campaign...');
  
  const { userId } = event;
  
  try {
    // Get user's GHL token and locationId
    const ghlData = await getValidGhlToken(userId);
    if (!ghlData) {
      throw new Error('GHL integration not found');
    }
    
    const { token: accessToken, locationId } = ghlData;
    
    // Fetch all contacts with app:synced tag
    const contacts = await fetchEligibleContacts(accessToken, locationId);
    console.log(`Found ${contacts.length} eligible contacts for email campaign`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Send email to each contact
    for (const contact of contacts) {
      try {
        await sendProspectingEmail(accessToken, contact);
        successCount++;
        
        // Rate limiting: 2 seconds between emails
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Failed to email ${contact.email}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`✅ Campaign complete: ${successCount} sent, ${failCount} failed`);
    
    return {
      statusCode: 200,
      success: true,
      totalContacts: contacts.length,
      successCount,
      failCount
    };
    
  } catch (error: any) {
    console.error('❌ Bulk email campaign error:', error);
    return {
      statusCode: 500,
      success: false,
      error: error.message
    };
  }
};

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
