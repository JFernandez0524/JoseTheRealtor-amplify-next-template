import { type AxiosInstance } from 'axios';
import { createGhlClient } from '../../shared/ghlClient';
import { AI_OUTREACH_TAG, mergeTagsForSync, shouldQueueForOutreach } from '../../shared/outreachGate';
import {
  DIRECT_MAIL_TAG,
  DIRECT_MAIL_TAGS,
  isDirectMailOnlyLead,
  labelsForSync,
  resolveDialablePhone,
} from '../../shared/contactChannels';
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

    // The number this contact is actually dialed on. `specificPhone` is the mobile handed to this
    // contact by the one-phone-one-contact loop; when the lead has no mobile, its best landline
    // takes that slot. The dialer reads only GHL's primary phone field, so a landline left in a
    // custom field would never be called.
    const dialablePhone = resolveDialablePhone(specificPhone, lead.landlinePhones);
    // Landlines beyond the one promoted above, for reference on the contact record.
    const extraLandlines = (lead.landlinePhones ?? []).filter(
      (n): n is string => typeof n === 'string' && n.trim() !== '' && n !== dialablePhone
    );

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
      // A landline makes this a phone contact. Keying only off `specificPhone` (the mobile) left
      // landline-only leads typed 'Direct Mail', so a dialer filtering on 'Phone Contact' never
      // saw them and the number sat unused.
      contact_type: dialablePhone ? 'Phone Contact' : 'Direct Mail',
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
      // ☎️ Any landlines beyond the one promoted to the primary phone field above. Deliberately
      // NOT fed through the per-phone contact loop in manualGhlSync/handler.ts (which iterates
      // `lead.phones`), so a landline never spawns a sibling contact.
      phone_2: isPrimary ? extraLandlines[0] || undefined : undefined,
      phone_3: isPrimary ? extraLandlines[1] || undefined : undefined,
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

    // 🎯 Define Tags based on primary status and phone eligibility.
    // `labelsForSync` drops a stale stored DIRECT_MAIL_ONLY verdict: 555 leads carry that label
    // from a skip trace run before landlines counted as contact, and 112 of them are callable
    // today. Shipping it verbatim re-mailed exactly the leads this rule is meant to stop mailing.
    const tags = [...labelsForSync(lead.leadLabels)];
    
    // 🆕 APP CONTROL TAGS (source of truth)
    tags.push('App:Synced');
    if (isAIPlan) tags.push('App:AI-Enabled');

    // ☎️ Channel marker so GHL workflows can route landline-only leads to the dialer and direct
    // mail while excluding them from anything that texts. Only set when the lead has no mobile —
    // `phones` empty is exactly the condition under which landlinePhones is populated.
    const isLandlineOnly = !specificPhone && (lead.landlinePhones?.length ?? 0) > 0;
    if (isLandlineOnly) tags.push('channel:landline');
    
    // 📊 DATA SOURCE TRACKING
    if (lead.skipTraceStatus === 'COMPLETED') {
      tags.push('Data:SkipTraced'); // Phone/email from skip trace
      
      // 🤖 AI OUTREACH - Only skip traced leads with EMAIL addresses (AI plan users or admins)
      const isAllowedUser = isAIPlan || isAdmin;
      if (isAllowedUser && primaryEmail) {
        tags.push(AI_OUTREACH_TAG); // Enable AI email outreach (EMAIL ONLY - requires email address)
      }
    } else if (specificPhone) {
      tags.push('Data:OriginalUpload'); // Phone was in original upload
    }
    
    // 🚨 BILLING STATUS CHECK (bypass for admins)
    if (!isAdmin && (appAccountStatus as string) === 'past_due') {
      tags.push('App:Billing-Hold');
    }
    
    // 🛡️ PROPERTY VALUE FILTER - Only mid-range properties get direct mail ($300k-$850k)
    const propertyValue = lead.zestimate || lead.estimatedValue || 0;
    const isDirectMailEligible = propertyValue >= 300000 && propertyValue <= 850000;

    // 🔢 Multi-Phone-Lead tag only for leads with multiple phones
    const hasMultiplePhones = lead.phones && lead.phones.length > 1;

    // 🚫 Lead-level do-not-call labels. Distinct from the per-phone `dnc` flag that
    // rankMobilePhones/rankLandlinePhones already filter on: this one comes from the CSV or a call
    // disposition and marks the *person* as off-limits however good the number is.
    const hasDoNotCallLabel = (lead.leadLabels || [])
      .filter((tag: any) => tag !== null)
      .some((tag: any) => ['DNC', 'Not_Interested', 'Do_Not_Call'].includes(tag));

    // 🛡️ DIRECT MAIL ELIGIBILITY — mail is the last resort, only once a skip trace has concluded
    // and turned up no mobile, no landline and no email. See shared/contactChannels.ts for the
    // rule and why the previous version had it backwards (it mailed leads *because* they had an
    // email, and mailed landline-reachable leads).
    //
    // `isPrimary` keeps a lead with several contacts from being mailed once per sibling.
    const isDirectMailOnly = isDirectMailOnlyLead(lead);
    const qualifiesForMail = isPrimary && isDirectMailEligible && isDirectMailOnly;

    // 🎯 DIALER CAMPAIGN LOGIC
    // A lead we can dial — on a mobile or a landline — is never routed to mail.
    if (dialablePhone && !hasDoNotCallLabel) {
      if (hasMultiplePhones) {
        tags.push('Multi-Phone-Lead');
      }
      // Routing is handled by the GHL workflow off the App:Synced tag.
    } else if (!qualifiesForMail) {
      // Not callable and not mailable — reachable by email, or outside the mail value window.
      tags.push('Digital-Only');
    }

    // 🛡️ Probate leads MUST have admin info
    if (lead.type?.toUpperCase() === 'PROBATE' && (!lead.adminFirstName || !lead.adminLastName)) {
      console.warn(`⚠️ Probate lead ${lead.id} missing admin info - using owner info as fallback`);
      // Use owner info as fallback instead of failing
      if (!lead.ownerFirstName && !lead.ownerLastName) {
        throw new Error('Probate leads require admin name or owner name. Cannot sync without contact information.');
      }
    }

    // 🛡️ DIRECT MAIL PROTECTION - Only ONE sibling gets mail eligibility
    if (qualifiesForMail) {
      tags.push('Thanks_IO_Eligible'); // Updated for Thanks.io
      tags.push(DIRECT_MAIL_TAG);
    }
    if (isPrimary) {
      tags.push('Primary_Contact');
    }

    const basePayload = {
      firstName: lead.adminFirstName || lead.ownerFirstName || 'Property',
      lastName: `${lead.adminLastName || lead.ownerLastName || 'Owner'}${specificPhone && phoneIndex > 1 ? ` (${phoneIndex})` : ''}`,
      email: isPrimary ? primaryEmail : undefined, // Attach email only to primary to avoid duplicates
      // The dialer reads only this field, so a landline-only lead must carry its landline here.
      phone: dialablePhone || undefined, // Don't send empty phone
      // Secondary emails stored in custom fields (email_2, email_3) instead of additionalEmails
      // GHL API rejects additionalEmails with string arrays
      tags,
      source: 'JTR_SkipTrace_App',
      assignedTo: assignedUserId || undefined, // Account-selected GHL user (omitted when unset)
      customFields,
    };

    // Tags are passed in rather than read off basePayload: whether `ai outreach` survives depends
    // on the *existing* contact's tags, which aren't known until the search below has run.
    const performUpdate = async (ghlId: string, payloadTags: string[]) => {
      console.info(`🔄 Updating contact ${ghlId}${dialablePhone ? ` with phone ${dialablePhone}` : ' (no phone)'}`);
      const res = await ghl.put(`/contacts/${ghlId}`, { ...basePayload, tags: payloadTags });
      return res.data?.contact?.id || ghlId;
    };

    // 🎯 SEARCH: Find existing contact with multiple fallback strategies
    let existingContact: any = null;

    try {
      // 0️⃣ The contact id we already recorded wins over any search. We wrote it on a previous
      // sync, so it is authoritative — searching is only for leads we have never synced.
      //
      // Skipping this is what duplicated contacts on 2026-07-28: a landline-only lead was looked
      // up by its landline, but the contact created *before* that landline existed carries no
      // phone at all, so nothing matched and the sync created a second contact. GHL workflows
      // picked the duplicate up and dialed it within a minute.
      if (isPrimary && lead.ghlContactId) {
        console.log(`🔗 Primary lead already linked to GHL contact ${lead.ghlContactId} — skipping search`);
        try {
          const known = await ghl.get(`/contacts/${lead.ghlContactId}`);
          if (known.data?.contact?.id) {
            existingContact = known.data.contact;
          } else {
            console.warn(`⚠️ Stored contact ${lead.ghlContactId} returned no contact — falling back to search`);
          }
        } catch (lookupError: any) {
          // A 404 means the contact was deleted in GHL; anything else is unresolvable. Only the
          // 404 is safe to recover from by searching — on any other error, stop rather than risk
          // creating a duplicate of a contact that is actually still there.
          if (lookupError.response?.status === 404) {
            console.warn(`⚠️ Stored contact ${lead.ghlContactId} no longer exists in GHL — falling back to search`);
          } else {
            throw lookupError;
          }
        }
      }

      if (existingContact) {
        // Already resolved above.
      } else if (dialablePhone) {
        // Search on whichever number this contact will carry — mobile or promoted landline.
        // Using specificPhone alone meant a landline-only lead was looked up by email or not at
        // all, so an existing GHL contact holding that landline went unmatched and was duplicated.
        // Try multiple phone formats
        const phoneVariations = [
          dialablePhone,
          dialablePhone.replace(/\D/g, ''), // Remove all non-digits
          `+1${dialablePhone.replace(/\D/g, '')}`, // Add +1 prefix
          dialablePhone.replace(/^\+1/, ''), // Remove +1 prefix
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
        } else if (!isPrimary && existingContact.id === lead.ghlContactId) {
          console.log(`ℹ️ Phone search matched primary contact (${lead.ghlContactId}) — clearing to create new contact for phone ${phoneIndex}`);
          existingContact = null;
        }
      }

      // 2️⃣ Email is a second, independent identity key — try it even when a phone search already
      // ran and missed. GHL refuses to create a contact whose email belongs to another contact
      // ("This location does not allow duplicated contacts"), so treating phone and email as
      // alternatives rather than fallbacks turned two landline leads into hard sync failures on
      // 2026-07-28: their landline matched nothing, and their email was never tried.
      if (isPrimary && !existingContact && primaryEmail) {
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
      }

      if (!existingContact && !dialablePhone && !primaryEmail) {
        // Nothing to search on — a mail-only lead identified by name and address alone.
        console.log(`📭 Skipping duplicate check for direct mail contact (no phone/email)`);
      }
    } catch (searchError: any) {
      // A failed search is "unknown", NOT "no match". Falling through to create would silently
      // duplicate a contact whenever the dedupe lookup is rate-limited — which is exactly what
      // happened on 2026-07-28 (76 × 429 on /contacts/search). The client already retries
      // transient failures with backoff (see shared/ghlClient.ts), so reaching here means the
      // search is genuinely unresolvable. Fail the lead instead: a retryable FAILED is cheaper to
      // fix than a duplicate the user has to find and merge in GHL.
      const detail = searchError.response?.data?.message || searchError.message;
      console.error(`⚠️ Contact search failed:`, searchError.response?.data || searchError.message);
      throw new Error(
        `Contact lookup failed, so the sync was stopped to avoid creating a duplicate contact: ${detail}`
      );
    }

    const createContact = async (payloadTags: string[]) => {
      console.info(
        `🆕 Creating new contact${dialablePhone ? ` for phone ${phoneIndex}: ${dialablePhone}` : ' with no phone (direct mail)'}`
      );
      const res = await ghl.post('/contacts/', {
        ...basePayload,
        tags: payloadTags,
        locationId: ghlLocationId,
      });
      return res.data?.contact?.id;
    };

    // Both paths converge here. Enrolment used to live inside the create branch only, so a lead
    // whose GHL contact already existed was synced but never queued for email outreach — see the
    // 2026-07-28 sync where 1 of 106 silently missed the queue for exactly this reason.
    // The PUT below REPLACES the contact's tags, so this list must carry everything the contact
    // should still have afterwards — including GHL-owned tags the app never computes (`mail:*`
    // delivery tracking, `conversation:*`, `email-cadence-complete`). Dropping the direct-mail tags
    // here is also what un-mails a lead that no longer qualifies; no separate removal call is
    // needed, and one was removed from this path because it duplicated the effect.
    const finalTags = mergeTagsForSync(
      tags,
      existingContact?.tags,
      qualifiesForMail ? [] : DIRECT_MAIL_TAGS
    );

    const contactId = existingContact
      ? await performUpdate(existingContact.id, finalTags)
      : await createContact(finalTags);

    // 📋 Add to outreach queue if contact has "ai outreach" tag.
    // Safe to run on every sync, including updates: addToOutreachQueue is idempotent (keyed
    // `${userId}_${contactId}`) and returns early when a row exists, preserving outreach progress.
    // finalTags, not tags — a contact whose `ai outreach` tag was withheld above must not be
    // enrolled in the queue either, or the cadence restarts through the back door.
    if (shouldQueueForOutreach(contactId, finalTags, primaryEmail)) {
      try {
        const { addToOutreachQueue } = await import('../../shared/outreachQueue');

        // SMS outreach disabled - EMAIL ONLY.
        // One queue row per contact, using the single best email (lead.emails is ranked
        // best-first by filterValidEmails). Emailing every address 2-3x'd volume and bounces.
        await addToOutreachQueue({
          userId,
          locationId: ghlLocationId,
          contactId,
          leadId: lead.id,
          contactName: `${basePayload.firstName} ${basePayload.lastName}`,
          contactPhone: undefined, // Email only
          // shouldQueueForOutreach already guarantees this is a non-empty string, but TypeScript
          // can't narrow through a boolean-returning call, and OutreachQueueItem takes
          // `string | undefined`. Coerce rather than making the gate a type predicate — it also
          // returns false when contactId or the tag is missing, so narrowing on the false branch
          // would be unsound.
          contactEmail: primaryEmail ?? undefined,
          propertyAddress: lead.ownerAddress,
          propertyCity: lead.ownerCity,
          propertyState: lead.ownerState,
          leadType: lead.type,
        });
        console.log(`✅ Added best email ${primaryEmail} to outreach queue`);
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
