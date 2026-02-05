import axios, { AxiosInstance, AxiosError } from 'axios';
import { DBLead } from '../../../../app/utils/aws/data/lead.server';

const GHL_CUSTOM_FIELD_ID_MAP: Record<string, string> = {
  mailing_address: '2RCYsC2cztJ1TWTh0tLt',
  mailing_city: '2F48dc4QEAOFHNgBNVcu',
  mailing_state: 'WzTPYXsXyPcnFSWn2UFf',
  mailing_zipcode: 'Vx4EIVAsIK3ej5jEv3Bm',
  property_address: 'p3NOYiInAERYbe0VsLHB',
  property_city: 'h4UIjKQvFu7oRW4SAY8W',
  property_state: '9r9OpQaxYPxqbA6Hvtx7',
  property_zip: 'hgbjsTVwcyID7umdhm2o',
  lead_source_id: 'PBInTgsd2nMCD3Ngmy0a', // 🎯 Used for Sibling Suppression
  lead_type: 'oaf4wCuM3Ub9eGpiddrO',
  contact_type: 'pGfgxcdFaYAkdq0Vp53j', // Phone Contact vs Direct Mail
  skiptracestatus: 'HrnY1GUZ7P6d6r7J0ZRc',
  zestimate: '7wIe1cRbZYXUnc3WOVb2', // Property value estimate (listing value)
  cash_offer: 'sM3hEOHCJFoPyWhj1Vc8', // 70% cash offer (as-is value)
  phone_2: 'LkmfM0Va5PylJFsJYjCu',
  phone_3: 'Cu6zwsuWrxoVWdxySc6t',
  phone_4: 'hxwJG0lYeV18IxxWh09H',
  phone_5: '8fIoSV1W05ciIrn01QT0',
  email_2: 'JY5nf3NzRwfCGvN5u00E',
  email_3: '1oy6TLKItn5RkebjI7kD',
  // 🆕 NEW APP CONTROL FIELDS
  app_user_id: 'CNoGugInWOC59hAPptxY',
  app_plan: 'YEJuROSCNnG9OXi3K8lb',
  app_account_status: 'diShiF2bpX7VFql08MVN',
  app_lead_id: 'aBlDP8DU3dFSHI2LFesn',
  ai_state: '1NxQW2kKMVgozjSUuu7s',
  // 📞 DIAL TRACKING FIELDS
  call_attempt_counter: '0MD4Pp2LCyOSCbCjA5qF',
  last_call_date: 'dWNGeSckpRoVUxXLgxMj',
  // 📧 EMAIL TRACKING FIELDS
  email_attempt_counter: 'wWlrXoXeMXcM6kUexf2L',
  last_email_date: '3xOBr4GvgRc22kBRNYCE',
};

// Opportunity field (separate from contact fields)
const GHL_OPPORTUNITY_FIELD_ID_MAP: Record<string, string> = {
  disposition: '5PTlyH0ahrPVzYTKicYn',
};

const createGhlClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28',
    },
  });

  client.interceptors.request.use((config) => {
    console.info(`📡 [GHL REQ] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      console.info(
        `✅ [GHL RES] ${response.status} from ${response.config.url}`
      );
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as any;
      console.error(
        `❌ [GHL ERR] ${error.response?.status || 'TIMEOUT'} on ${config?.url}`
      );
      if (error.response?.data)
        console.error(`📄 [GHL ERR DATA]`, JSON.stringify(error.response.data));

      if (!config || !config.retryCount) config.retryCount = 0;
      const shouldRetry =
        config.retryCount < 3 &&
        (error.code === 'ECONNABORTED' ||
          (error.response?.status && error.response.status >= 500));

      if (shouldRetry) {
        config.retryCount += 1;
        const delay = config.retryCount * 1000;
        console.warn(
          `⚠️ [RETRY] Attempt ${config.retryCount}/3 in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return client(config);
      }
      return Promise.reject(error);
    }
  );
  return client;
};

// 🎯 Updated parameters for "1 Phone = 1 Contact" strategy
export async function syncToGoHighLevel(
  lead: DBLead,
  specificPhone: string,
  phoneIndex: number,
  isPrimary: boolean,
  userGroups: string[] = [],
  userId: string = '',
  ghlToken: string,
  ghlLocationId: string
): Promise<string> {
  const ghl = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${ghlToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28',
    },
  });

  try {
    const primaryEmail = lead.emails?.[0]?.toLowerCase() || null;

    // 🆕 Determine user plan and account status
    const isAIPlan = userGroups.includes('AI_PLAN');
    const isPROPlan = userGroups.includes('PRO');
    const isAdmin = userGroups.includes('ADMINS');
    
    const appPlan = isAdmin ? 'AI' : isAIPlan ? 'AI' : isPROPlan ? 'SYNC' : 'SYNC'; // Admins get AI plan
    const appAccountStatus = 'active'; // TODO: Add billing status check for 'past_due'/'canceled'

    // 🎯 Construct Custom Field Values
    const zestimateValue = lead.zestimate || lead.estimatedValue || 0;
    const cashOfferValue = Math.round(zestimateValue * 0.70); // 70% rule for cash offer

    const customFieldValues: Record<string, any> = {
      property_address: lead.ownerAddress,
      property_city: lead.ownerCity,
      property_state: lead.ownerState,
      property_zip: lead.ownerZip,
      mailing_address: lead.mailingAddress,
      mailing_city: lead.mailingCity,
      mailing_state: lead.mailingState,
      mailing_zipcode: lead.mailingZip,
      lead_type: lead.type === 'PROBATE' ? 'Probate' : lead.type === 'PREFORECLOSURE' ? 'Preforeclosure' : lead.type,
      contact_type: specificPhone ? 'Phone Contact' : 'Direct Mail',
      skiptracestatus: lead.skipTraceStatus?.toUpperCase() || 'PENDING',
      lead_source_id: lead.id, // 🎯 Shared Lead ID for suppression workflows
      zestimate: zestimateValue, // Full market value (listing value)
      cash_offer: cashOfferValue, // 70% cash offer (as-is value)
      // 🆕 APP CONTROL FIELDS
      app_user_id: userId,
      app_plan: appPlan,
      app_account_status: appAccountStatus,
      app_lead_id: lead.id,
      ai_state: isAIPlan ? 'not_started' : 'not_started', // Always start with not_started
    };

    const customFields = Object.keys(customFieldValues)
      .filter((key) => customFieldValues[key] && GHL_CUSTOM_FIELD_ID_MAP[key])
      .map((key) => ({
        id: GHL_CUSTOM_FIELD_ID_MAP[key],
        value: String(customFieldValues[key]), // Use 'value' not 'field_value'
      }));

    // 🎯 Define Tags based on primary status and phone eligibility
    const tags = [...(lead.leadLabels || [])];
    
    // 🆕 APP CONTROL TAGS (source of truth)
    tags.push('App:Synced');
    if (isAIPlan) tags.push('App:AI-Enabled');
    
    // 📊 DATA SOURCE TRACKING
    if (lead.skipTraceStatus === 'COMPLETED') {
      tags.push('Data:SkipTraced'); // Phone/email from skip trace
      
      // 🤖 AI OUTREACH - Only for AI plan users and admins
      if (isAIPlan || isAdmin) {
        tags.push('ai outreach'); // Enable AI outreach for skip traced leads (lowercase to match queue check)
      }
    } else if (specificPhone) {
      tags.push('Data:OriginalUpload'); // Phone was in original upload
    }
    
    // 🚨 BILLING STATUS CHECK (bypass for admins)
    if (!isAdmin && (appAccountStatus as string) === 'past_due') {
      tags.push('App:Billing-Hold');
    }
    
    // 🎯 DIALER CAMPAIGN LOGIC - All users need completed skip trace + phone
    const isCallable = specificPhone && 
                      lead.skipTraceStatus === 'COMPLETED' && 
                      !(lead.leadLabels || []).filter((tag: any) => tag !== null).some((tag: any) => ['DNC', 'Not_Interested', 'Do_Not_Call'].includes(tag));
    
    // 🛡️ PROPERTY VALUE FILTER - Only mid-range properties get direct mail ($300k-$850k)
    const propertyValue = lead.zestimate || lead.estimatedValue || 0;
    const isDirectMailEligible = propertyValue >= 300000 && propertyValue <= 850000;
    
    if (isCallable) {
      tags.push('Multi-Phone-Lead');
      // Removed 'start dialing campaign' - GHL workflow handles routing based on App:Synced tag
    } else if (specificPhone) {
      // Has phone but not callable (failed skip trace, DNC, etc.)
      tags.push('Multi-Phone-Lead');
      if (isDirectMailEligible) {
        tags.push('Direct-Mail-Only'); // Route to mail for $300k-$850k properties
      } else {
        tags.push('Digital-Only'); // Outside $300k-$850k range - no direct mail
      }
    } else {
      // No phone at all
      if (isDirectMailEligible) {
        tags.push('Direct-Mail-Only');
      } else {
        tags.push('Digital-Only'); // Outside $300k-$850k range - no direct mail
      }
    }
    
    // 🛡️ Probate leads MUST have admin info
    if (lead.type?.toUpperCase() === 'PROBATE' && (!lead.adminFirstName || !lead.adminLastName)) {
      console.warn(`⚠️ Probate lead ${lead.id} missing admin info - using owner info as fallback`);
      // Use owner info as fallback instead of failing
      if (!lead.ownerFirstName && !lead.ownerLastName) {
        throw new Error('Probate leads require admin name or owner name. Cannot sync without contact information.');
      }
    }

    // 🛡️ DIRECT MAIL PROTECTION - Only ONE sibling gets mail eligibility (and only if in $300k-$850k range)
    if (isPrimary && isDirectMailEligible) {
      tags.push('Thanks_IO_Eligible'); // Updated for Thanks.io
      tags.push('Primary_Contact');
    } else if (isPrimary) {
      tags.push('Primary_Contact');
      // No Thanks_IO_Eligible tag for properties outside $300k-$850k range
    }

    const basePayload = {
      firstName: lead.adminFirstName || lead.ownerFirstName || 'Property',
      lastName: `${lead.adminLastName || lead.ownerLastName || 'Owner'}${specificPhone && phoneIndex > 1 ? ` (${phoneIndex})` : ''}`,
      email: isPrimary ? primaryEmail : undefined, // Attach email only to primary to avoid duplicates
      phone: specificPhone || undefined, // Don't send empty phone
      tags,
      source: 'JTR_SkipTrace_App',
      customFields,
    };

    const performUpdate = async (ghlId: string) => {
      console.info(`🔄 Updating contact ${ghlId}${specificPhone ? ` with phone ${specificPhone}` : ' (direct mail only)'}`);
      const res = await ghl.put(`/contacts/${ghlId}`, basePayload);
      return res.data?.contact?.id || ghlId;
    };

    // 🎯 SEARCH: Find existing contact
    let existingContact: any = null;
    
    if (specificPhone) {
      // Search by phone if available
      const searchBody = {
        locationId: ghlLocationId,
        pageLimit: 1,
        filters: [{ field: 'phone', operator: 'eq', value: specificPhone }],
      };
      const searchRes = await ghl.post('/contacts/search', searchBody);
      if (searchRes.data?.contacts?.length > 0) {
        existingContact = searchRes.data.contacts[0];
      }
    } else {
      // Search by email or name for direct mail leads
      if (primaryEmail) {
        const searchBody = {
          locationId: ghlLocationId,
          pageLimit: 1,
          filters: [{ field: 'email', operator: 'eq', value: primaryEmail }],
        };
        const searchRes = await ghl.post('/contacts/search', searchBody);
        if (searchRes.data?.contacts?.length > 0) {
          existingContact = searchRes.data.contacts[0];
        }
      }
    }

    if (existingContact) return await performUpdate(existingContact.id);

    console.info(
      `🆕 Creating new contact${specificPhone ? ` for phone ${phoneIndex}: ${specificPhone}` : ' for direct mail workflow'}`
    );
    const res = await ghl.post('/contacts/', {
      ...basePayload,
      locationId: ghlLocationId,
    });
    const contactId = res.data?.contact?.id;
    
    // 📋 Add to outreach queue if contact has "ai outreach" tag
    if (contactId && tags.includes('ai outreach')) {
      try {
        const { addToOutreachQueue } = await import('../../shared/outreachQueue');
        await addToOutreachQueue({
          userId,
          locationId: ghlLocationId,
          contactId,
          contactName: `${basePayload.firstName} ${basePayload.lastName}`,
          contactPhone: specificPhone,
          contactEmail: primaryEmail || undefined,
          propertyAddress: lead.ownerAddress,
          propertyCity: lead.ownerCity,
          propertyState: lead.ownerState,
          leadType: lead.type,
        });
        console.log(`✅ Added contact ${contactId} to outreach queue`);
      } catch (queueError) {
        console.error(`⚠️ Failed to add to outreach queue:`, queueError);
        // Don't fail the sync if queue add fails
      }
    }
    
    // Email outreach is handled by dailyEmailAgent (7-touch cadence over 28 days)
    // No initial email sent during sync
    
    return contactId;
  } catch (error: any) {
    throw new Error(
      `GHL sync failed: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Sends initial prospecting email to new contact
 */
async function sendInitialProspectingEmail(
  ghl: AxiosInstance,
  contactId: string,
  lead: DBLead,
  primaryEmail: string,
  locationId: string
): Promise<void> {
  try {
    // Get user's email from location settings
    const locationResponse = await ghl.get(`/locations/${locationId}`);
    const fromEmail = locationResponse.data.location?.email || 'jose.fernandez@josetherealtor.com';
    
    const propertyAddress = `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`;
    const zestimate = lead.zestimate || lead.estimatedValue || 0;
    const cashOffer = Math.round(zestimate * 0.70);
    const leadType = lead.type === 'PROBATE' ? 'probate' : 'preforeclosure';
    
    // Collect all email addresses
    const emails = [primaryEmail];
    if (lead.emails && lead.emails.length > 1) {
      const additionalEmails = lead.emails.slice(1).filter((e): e is string => e !== null && e.length > 0);
      emails.push(...additionalEmails);
    }
    
    const subject = `Interested in Your Property at ${lead.ownerAddress}`;
    const html = `
      <p>Hi ${lead.adminFirstName || lead.ownerFirstName || 'there'},</p>
      
      <p>I noticed your ${leadType} property at <strong>${propertyAddress}</strong> and wanted to reach out.</p>
      
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
    
    // Send to all email addresses
    for (const emailAddr of emails) {
      await ghl.post('/conversations/messages', {
        type: 'Email',
        contactId: contactId,
        emailFrom: fromEmail,
        subject: subject,
        html: html
      });
      console.info(`📧 Sent initial prospecting email to ${emailAddr} from ${fromEmail}`);
    }
    
    // Update email tracking fields
    await ghl.put(`/contacts/${contactId}`, {
      customFields: [
        { id: GHL_CUSTOM_FIELD_ID_MAP.email_attempt_counter, value: '1' },
        { id: GHL_CUSTOM_FIELD_ID_MAP.last_email_date, value: new Date().toISOString().split('T')[0] }
      ]
    });
    
  } catch (error: any) {
    console.error(`Failed to send initial email:`, error.response?.data || error.message);
    // Don't throw - email failure shouldn't block contact creation
  }
}
