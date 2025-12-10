import axios from 'axios';

// Use Lambda environment variable
const GHL_API_KEY = process.env.GHL_API_KEY;

// Define the shape of the lead coming from your Database
interface DBLead {
  id: string;
  type: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;

  adminFirstName?: string;
  adminLastName?: string;

  // Mailing Info
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;

  phones?: string[];
  emails?: string[];
  isAbsenteeOwner?: boolean;
  estimatedEquity?: number | null;
}

export async function syncToGoHighLevel(lead: DBLead) {
  if (!GHL_API_KEY) {
    console.warn('⚠️ GHL Sync Skipped: No API Key found.');
    return;
  }

  try {
    // 1. Logic: Determine Contact Name (Probate = Admin, Pre-foreclosure = Owner)
    let firstName = lead.ownerFirstName || 'Unknown';
    let lastName = lead.ownerLastName || 'Owner';

    if (lead.type?.toUpperCase() === 'PROBATE') {
      firstName = lead.adminFirstName || firstName;
      lastName = lead.adminLastName || lastName;
    }

    // 2. Logic: Extract Contacts from Arrays
    const primaryEmail =
      lead.emails && lead.emails.length > 0
        ? lead.emails[0]
        : `no-email-${Date.now()}@example.com`; // Dummy email to ensure GHL creation

    const primaryPhone =
      lead.phones && lead.phones.length > 0 ? lead.phones[0] : null;

    // Safety Check: If no phone and we are just generating a fake email, it might be low value.
    // But we'll proceed so you at least have the record.

    // 3. Logic: Dynamic Tags
    const tags = [
      lead.type, // "PROBATE" or "PREFORECLOSURE"
      'Imported from App',
      'Start Dialing Campaign',
    ];
    if (lead.isAbsenteeOwner) tags.push('Absentee Owner');

    // 4. Construct Payload
    // 🟢 CRITICAL: Map 'mailingAddress' to GHL's main address so mailers work.
    const payload: any = {
      locationId: 'mHaAy3ZaUHgrbPyughDG', // Keep your hardcoded ID if needed, or remove if API Key handles it
      firstName: firstName,
      lastName: lastName,
      email: primaryEmail,
      phone: primaryPhone,

      // Main Address = Mailing Address (Admin or Absentee Owner)
      address1: lead.mailingAddress || '',
      city: lead.mailingCity || '',
      state: lead.mailingState || '',
      postalCode: lead.mailingZip || '',
      country: 'US',

      source: 'App Skip Trace',
      tags: tags,
      dnd: false,

      // 🟢 CUSTOM FIELDS: Store the actual Property Info here
      // You must create these keys in GHL Settings -> Custom Fields
      customField: {
        property_address: lead.ownerAddress,
        property_city: lead.ownerCity,
        property_state: lead.ownerState,
        property_zip: lead.ownerZip,
        lead_source_id: lead.id,
      },
    };

    // Clean payload (GHL rejects empty phone strings)
    if (!payload.phone) delete payload.phone;

    // 5. Send Request
    const url = 'https://services.leadconnectorhq.com/contacts';

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Version: '2021-07-28', // Keep your working version
      },
    });

    console.log('✅ Synced to GoHighLevel. ID:', res.data?.contact?.id);
    return res.data;
  } catch (error: any) {
    const serverMsg =
      error.response?.data?.message || JSON.stringify(error.response?.data);

    // Graceful handling for duplicates (400/409)
    if (
      error.response?.status === 400 &&
      serverMsg.includes('Phone number already exists')
    ) {
      console.warn(`⚠️ Lead exists in GHL (Phone Duplicate): ${lead.id}`);
      return;
    }

    console.error(
      `❌ GoHighLevel sync failed (${error.response?.status}): ${serverMsg}`
    );
  }
}
