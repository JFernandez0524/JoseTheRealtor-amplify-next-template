// amplify/functions/manualGhlSync/integrations/gohighlevel.ts

import axios from 'axios';
// 💥 1. IMPORT CANONICAL DBLead TYPE from your centralized file
import { DBLead } from '../../../../app/utils/aws/data/lead.server';

// -----------------------------------------------------------------------
// 💥 STEP 1: GHL CUSTOM FIELD ID MAP (Unchanged)
// -----------------------------------------------------------------------
const GHL_CUSTOM_FIELD_ID_MAP: Record<string, string> = {
  // Mailing Address Fields (Slugs -> IDs)
  mailing_address: '2RCYsC2cztJ1TWTh0tLt',
  mailing_city: '2F48dc4QEAOFHNgBNVcu',
  mailing_state: 'WzTPYXsXyPcnFSWn2UFf',
  mailing_zipcode: 'Vx4EIVAsIK3ej5jEv3Bm', // Property Address Fields
  property_address: 'p3NOYiInAERYbe0VsLHB',
  property_city: 'h4UIjKQvFu7oRW4SAY8W',
  property_state: '9r9OpQaxYPxqbA6Hvtx7',
  property_zip: 'hgbjsTVwcyID7umdhm2o', // Lead Metadata
  lead_source_id: 'PBInTgsd2nMCD3Ngmy0a',
  type: '3zHY47rcT4o2PXNAfLul',
  lead_type: 'oaf4wCuM3Ub9eGpiddrO',
  skiptracestatus: 'HrnY1GUZ7P6d6r7J0ZRc', // Additional Phones & Emails
  phone_2: 'LkmfM0Va5PylJFsJYjCu',
  phone_3: 'Cu6zwsuWrxoVWdxySc6t',
  phone_4: 'hxwJG0lYeV18IxxWh09H',
  phone_5: '8fIoSV1W05ciIrn01QT0',
  email_2: 'JY5nf3NzRwfCGvN5u00E',
  email_3: '1oy6TLKItn5RkebjI7kD',
};
// -----------------------------------------------------------------------

const GHL_API_KEY = process.env.GHL_API_KEY;

// 💥 2. LOCAL INTERFACE DBLead REMOVED
// The type is now correctly imported and used below.

/**
 * Syncs a lead record to GoHighLevel (creating or updating a contact).
 * Returns the GHL contact ID on success or throws an error on failure.
 * @param lead The enriched DBLead object (using imported type).
 * @returns The GoHighLevel contact ID (string).
 */
export async function syncToGoHighLevel(lead: DBLead): Promise<string> {
  // ⬅️ Returns GHL Contact ID (string)
  if (!GHL_API_KEY) {
    // This warning should be handled upstream, but we keep it here for defense
    console.warn(
      '⚠️ GHL Sync Skipped: No GHL_API_KEY found in environment variables.'
    ); // Since the upstream handler checks this and updates status to SKIPPED,
    throw new Error('GHL_API_KEY Missing');
  }

  try {
    // 1. Logic: Determine Contact Name
    // Note: lead.ownerFirstName is correctly treated as string | null | undefined
    let firstName = lead.ownerFirstName || 'Unknown';
    let lastName = lead.ownerLastName || 'Owner';

    if (lead.type?.toUpperCase() === 'PROBATE') {
      firstName = lead.adminFirstName || firstName;
      lastName = lead.adminLastName || lastName;
    } // 2. Logic: Extract Contacts from Arrays

    const primaryEmail =
      lead.emails && lead.emails.length > 0
        ? lead.emails[0]
        : `no-email-${Date.now()}@example.com`;
    const primaryPhone =
      lead.phones && lead.phones.length > 0 ? lead.phones[0] : null; // 3. Logic: Dynamic Tags

    const tags = ['Start Dialing Campaign'];
    if (lead.isAbsenteeOwner) tags.push('Absentee Owner'); // -----------------------------------------------------------------------
    // 💥 STEP 2: Custom Field Transformation Logic (Corrected) 💥
    // -----------------------------------------------------------------------
    // A. Create a map of GHL Custom Field Key (slug) to its value.

    const customFieldsMap: Record<string, any> = {
      // Mailing Address Custom Fields
      mailing_address: lead.mailingAddress || '',
      mailing_city: lead.mailingCity || '',
      mailing_state: lead.mailingState || '',
      mailing_zipcode: lead.mailingZip || '', // Property Address Custom Fields

      property_address: lead.ownerAddress || '',
      property_city: lead.ownerCity || '',
      property_state: lead.ownerState || '',
      property_zip: lead.ownerZip || '', // Lead Metadata Custom Fields

      lead_source_id: lead.id, // Note: 'type' is a system field in GHL, 'lead_type' is your custom field
      lead_type: lead.type,
      skiptracestatus: lead.skipTraceStatus, // Additional Phones & Emails

      phone_2: lead.phones?.[1] || '',
      phone_3: lead.phones?.[2] || '',
      phone_4: lead.phones?.[3] || '',
      phone_5: lead.phones?.[4] || '',
      email_2: lead.emails?.[1] || '',
      email_3: lead.emails?.[2] || '',
    }; // B. Transform the map into the array of objects using the required 'id'

    const ghlCustomFields = Object.keys(customFieldsMap)
      .filter(
        (
          key // Only include if value is not empty/null/undefined AND we have a UUID for it
        ) =>
          customFieldsMap[key] !== '' &&
          customFieldsMap[key] !== null &&
          GHL_CUSTOM_FIELD_ID_MAP[key]
      )
      .map((key) => ({
        id: GHL_CUSTOM_FIELD_ID_MAP[key], // Required GHL UUID
        field_value: customFieldsMap[key],
      })); // 4. Construct Final Payload

    const payload: any = {
      locationId: 'mHaAy3ZaUHgrbPyughDG', // Your hardcoded location ID
      firstName: firstName,
      lastName: lastName,
      email: primaryEmail,
      phone: primaryPhone,
      country: 'US',
      source: 'JTR_SkipTrace_App',
      tags: tags,
      dnd: false,
      customFields: ghlCustomFields,
    }; // Clean payload

    if (!payload.phone) delete payload.phone; // 5. Send Request - GHL's API handles create or update based on email/phone

    const url = 'https://services.leadconnectorhq.com/contacts';

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Version: '2021-07-28', // Use the recommended version
      },
    });

    const contactId = res.data?.contact?.id;
    console.log('✅ Synced to GoHighLevel. ID:', contactId);
    return contactId; // ⬅️ Return the contact ID on SUCCESS
  } catch (error: any) {
    const serverMsg =
      error.response?.data?.message || JSON.stringify(error.response?.data); // Check for the known "Contact Exists" error (usually HTTP 400)

    if (
      error.response?.status === 400 &&
      (serverMsg.includes('Phone number already exists') ||
        serverMsg.includes('Email already exists'))
    ) {
      console.warn(
        `⚠️ Lead exists in GHL (Duplicate Found). Sync failed for: ${lead.id}`
      );
    } // Throw the full error to be caught by the upstream processGhlSync helper.

    throw new Error(
      `GHL sync failed (Status ${error.response?.status}): ${serverMsg}`
    );
  }
}
