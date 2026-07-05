import { type AxiosInstance } from 'axios';
import { createGhlClient } from '../../shared/ghlClient';
import { DBLead } from '../../../../app/utils/aws/data/lead.server';

// 🎯 Updated parameters for "1 Phone = 1 Contact" strategy
export async function syncToGoHighLevel(
  lead: DBLead,
  specificPhone: string,
  phoneIndex: number,
  isPrimary: boolean,
  userGroups: string[] = [],
  userId: string = '',
  ghlToken: string,
  ghlLocationId: string,
  fieldIds: Record<string, string> = {},
  opportunityFieldIds: Record<string, string> = {},
  assignedUserId: string = ''
): Promise<string> {
  const ghl = createGhlClient(ghlToken);

  try {
    const primaryEmail = lead.emails?.[0]?.toLowerCase() || null;

    // 🆕 Determine user plan and account status
    const isAIPlan = userGroups.includes('AI_PLAN');
    const isPROPlan = userGroups.includes('PRO');
    const isAdmin = userGroups.includes('ADMINS');
    
    const appPlan = isAdmin ? 'AI' : isAIPlan ? 'AI' : isPROPlan ? 'SYNC' : 'SYNC'; // Admins get AI plan
    const appAccountStatus = 'active'; // TODO: Add billing status check for 'past_due'/'canceled'

    // 🔗 Build Zillow search URL from property address components
    const buildZillowUrl = (address: string, city: string, state: string, zip: string): string => {
      const parts = [address, city, state, zip]
        .filter(Boolean)
        .join(' ')
        .replace(/[^a-zA-Z0-9\s]/g, '') // strip punctuation
        .trim()
        .replace(/\s+/g, '-');           // spaces → hyphens
      return `https://www.zillow.com/homes/${parts}_rb/`;
    };

    // 🎯 Construct Custom Field Values
    const zestimateValue = lead.zestimate || lead.estimatedValue || 0;
    const cashOfferValue = Math.round(zestimateValue * 0.70); // 70% rule for cash offer

    // Helper to convert ALL CAPS to Title Case for USPS compatibility
    const toTitleCase = (str: string) => {
      if (!str) return str;
      return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // Use standardized addresses for USPS compatibility (thanks.io)
    const mailingAddr = toTitleCase((lead.adminStandardizedAddress as any)?.street?.S || lead.mailingAddress);
    const mailingCity = toTitleCase((lead.adminStandardizedAddress as any)?.city?.S || lead.mailingCity);
    const mailingState = (lead.adminStandardizedAddress as any)?.state?.S || lead.mailingState;
    const mailingZip = (lead.adminStandardizedAddress as any)?.zip?.S || lead.mailingZip;

    const propAddress = toTitleCase((lead.standardizedAddress as any)?.street || lead.ownerAddress);
    const propCity    = toTitleCase((lead.standardizedAddress as any)?.city  || lead.ownerCity);
    const propState   = (lead.standardizedAddress as any)?.state || lead.ownerState;
    const propZip     = (lead.standardizedAddress as any)?.zip   || lead.ownerZip;

    const customFieldValues: Record<string, any> = {
      property_address: propAddress,
      property_city:    propCity,
      property_state:   propState,
      property_zip:     propZip,
      property_county: lead.ownerCounty ? toTitleCase(lead.ownerCounty) : undefined,
      // Prefer the direct zpid URL from Bridge API; fall back to address-based search URL
      zillow_link: lead.zillowUrl
        || (lead.zillowZpid ? `https://www.zillow.com/homes/${lead.zillowZpid}_zpid/` : null)
        || (propAddress ? buildZillowUrl(propAddress, propCity || '', propState || '', propZip || '') : undefined),
      mailing_address: mailingAddr,
      mailing_city: mailingCity,
      mailing_state: mailingState,
      mailing_zipcode: mailingZip,
      lead_type: lead.type === 'PROBATE' ? 'Probate' : lead.type === 'PREFORECLOSURE' ? 'Preforeclosure' : lead.type,
      contact_type: specificPhone ? 'Phone Contact' : 'Direct Mail',
      skiptracestatus: lead.skipTraceStatus?.toUpperCase() || 'PENDING',
      listing_status: lead.listingStatus || 'off market',
      lead_source_id: lead.id, // 🎯 Shared Lead ID for suppression workflows
      zestimate: zestimateValue, // Full market value (listing value)
      cash_offer: cashOfferValue, // 70% cash offer (as-is value)
      // 🏠 Property tier based on value
      property_tier: (() => {
        const value = lead.zestimate || lead.estimatedValue || 0;
        if (value > 850000) return 'luxury';
        if (value >= 300000) return 'mid_range';
        return 'entry_level';
      })(),
      // 📧 Additional emails
      email_2: lead.emails?.[1] || undefined,
      email_3: lead.emails?.[2] || undefined,
      // 🆕 APP CONTROL FIELDS
      // NOTE: app_plan / app_account_status are DISPLAY-ONLY mirrors of Cognito groups.
      // They are never read back as an entitlement source — editing them in GHL cannot
      // change a user's plan or billing. See docs/SECURITY_NOTES.md.
      app_user_id: userId,
      app_plan: appPlan,
      app_account_status: appAccountStatus,
      app_lead_id: lead.id,
      ai_state: isAIPlan ? 'not_started' : 'not_started', // Always start with not_started
    };

    const customFields = Object.keys(customFieldValues)
      .filter((key) => customFieldValues[key] && fieldIds[key])
      .map((key) => ({
        id: fieldIds[key],
        value: String(customFieldValues[key]),
      }));

    // 🎯 Define Tags based on primary status and phone eligibility
    const tags = [...(lead.leadLabels || [])];
    
    // 🆕 APP CONTROL TAGS (source of truth)
    tags.push('App:Synced');
    if (isAIPlan) tags.push('App:AI-Enabled');
    
    // 📊 DATA SOURCE TRACKING
    if (lead.skipTraceStatus === 'COMPLETED') {
      tags.push('Data:SkipTraced'); // Phone/email from skip trace
      
      // 🤖 AI OUTREACH - Only skip traced leads with EMAIL addresses (AI plan users or admins)
      const isAllowedUser = isAIPlan || isAdmin;
      if (isAllowedUser && primaryEmail) {
        tags.push('ai outreach'); // Enable AI email outreach (EMAIL ONLY - requires email address)
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
    
    // 🔢 Multi-Phone-Lead tag only for leads with multiple phones
    const hasMultiplePhones = lead.phones && lead.phones.length > 1;
    
    if (isCallable) {
      if (hasMultiplePhones) {
        tags.push('Multi-Phone-Lead');
      }
      // Removed 'start dialing campaign' - GHL workflow handles routing based on App:Synced tag
    } else if (specificPhone) {
      // Has phone but not callable (failed skip trace, DNC, etc.)
      if (hasMultiplePhones) {
        tags.push('Multi-Phone-Lead');
      }
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

    // 🛡️ DIRECT MAIL ELIGIBILITY - Only for leads that need direct mail
    // Criteria: NO_MATCH, NO_QUALITY_CONTACTS, or only emails (no phones)
    const isDirectMailOnly = 
      lead.skipTraceStatus === 'NO_MATCH' || 
      lead.skipTraceStatus === 'NO_QUALITY_CONTACTS' ||
      (!specificPhone && (lead.emails && lead.emails.length > 0));
    
    // 🛡️ DIRECT MAIL PROTECTION - Only ONE sibling gets mail eligibility (and only if direct mail criteria met)
    if (isPrimary && isDirectMailEligible && isDirectMailOnly) {
      tags.push('Thanks_IO_Eligible'); // Updated for Thanks.io
      tags.push('Primary_Contact');
      tags.push('direct-mail-only'); // Replace probate_mail tag
    } else if (isPrimary) {
      tags.push('Primary_Contact');
      // No Thanks_IO_Eligible tag - either has phone or outside value range
    }

    const basePayload = {
      firstName: lead.adminFirstName || lead.ownerFirstName || 'Property',
      lastName: `${lead.adminLastName || lead.ownerLastName || 'Owner'}${specificPhone && phoneIndex > 1 ? ` (${phoneIndex})` : ''}`,
      email: isPrimary ? primaryEmail : undefined, // Attach email only to primary to avoid duplicates
      phone: specificPhone || undefined, // Don't send empty phone
      // Secondary emails stored in custom fields (email_2, email_3) instead of additionalEmails
      // GHL API rejects additionalEmails with string arrays
      tags,
      source: 'JTR_SkipTrace_App',
      assignedTo: assignedUserId || undefined, // Account-selected GHL user (omitted when unset)
      customFields,
    };

    const performUpdate = async (ghlId: string) => {
      console.info(`🔄 Updating contact ${ghlId}${specificPhone ? ` with phone ${specificPhone}` : ' (direct mail only)'}`);
      const res = await ghl.put(`/contacts/${ghlId}`, basePayload);
      return res.data?.contact?.id || ghlId;
    };

    // 🎯 SEARCH: Find existing contact with multiple fallback strategies
    let existingContact: any = null;
    
    try {
      if (specificPhone) {
        // Try multiple phone formats
        const phoneVariations = [
          specificPhone,
          specificPhone.replace(/\D/g, ''), // Remove all non-digits
          `+1${specificPhone.replace(/\D/g, '')}`, // Add +1 prefix
          specificPhone.replace(/^\+1/, ''), // Remove +1 prefix
        ].filter((v, i, arr) => arr.indexOf(v) === i); // Unique values only

        console.log(`🔍 Searching for existing contact by phone variations:`, phoneVariations);
        
        for (const phoneVar of phoneVariations) {
          const searchBody = {
            locationId: ghlLocationId,
            pageLimit: 1,
            filters: [{ field: 'phone', operator: 'eq', value: phoneVar }],
          };
          const searchRes = await ghl.post('/contacts/search', searchBody);
          if (searchRes.data?.contacts?.length > 0) {
            existingContact = searchRes.data.contacts[0];
            console.log(`✅ Found existing contact by phone (${phoneVar}): ${existingContact.id}`);
            break;
          }
        }
        
        if (!existingContact) {
          console.log(`📭 No existing contact found by any phone variation`);
        }
      } else if (primaryEmail) {
        // Search by email (case-insensitive)
        console.log(`🔍 Searching for existing contact by email: ${primaryEmail}`);
        const searchBody = {
          locationId: ghlLocationId,
          pageLimit: 1,
          filters: [{ field: 'email', operator: 'eq', value: primaryEmail.toLowerCase() }],
        };
        const searchRes = await ghl.post('/contacts/search', searchBody);
        if (searchRes.data?.contacts?.length > 0) {
          existingContact = searchRes.data.contacts[0];
          console.log(`✅ Found existing contact by email: ${existingContact.id}`);
        } else {
          console.log(`📭 No existing contact found by email`);
        }
      } else if (basePayload.firstName && basePayload.lastName) {
        // Skip duplicate check for direct mail contacts (no phone/email to search by)
        console.log(`📭 Skipping duplicate check for direct mail contact (no phone/email)`);
      }
    } catch (searchError: any) {
      console.error(`⚠️ Contact search failed:`, searchError.response?.data || searchError.message);
      // Continue to create new contact if search fails
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

        // SMS outreach disabled - EMAIL ONLY.
        // One queue row per contact, using the single best email (lead.emails is ranked
        // best-first by filterValidEmails). Emailing every address 2-3x'd volume and bounces.
        if (primaryEmail) {
          await addToOutreachQueue({
            userId,
            locationId: ghlLocationId,
            contactId,
            leadId: lead.id,
            contactName: `${basePayload.firstName} ${basePayload.lastName}`,
            contactPhone: undefined, // Email only
            contactEmail: primaryEmail,
            propertyAddress: lead.ownerAddress,
            propertyCity: lead.ownerCity,
            propertyState: lead.ownerState,
            leadType: lead.type,
          });
          console.log(`✅ Added best email ${primaryEmail} to outreach queue`);
        }

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
  locationId: string,
  fieldIds: Record<string, string> = {}
): Promise<void> {
  try {
    // Get user's email from location settings
    const locationResponse = await ghl.get(`/locations/${locationId}`);
    const fromEmail = locationResponse.data.location?.email;
    if (!fromEmail) {
      console.warn('[GHL_SYNC] No location email found — skipping prospecting email send');
      return;
    }
    
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
      Your Agent</p>
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
        { id: fieldIds.email_attempt_counter, value: '1' },
        { id: fieldIds.last_email_date, value: new Date().toISOString().split('T')[0] }
      ].filter(f => f.id)
    });
    
  } catch (error: any) {
    console.error(`Failed to send initial email:`, error.response?.data || error.message);
    // Don't throw - email failure shouldn't block contact creation
  }
}
