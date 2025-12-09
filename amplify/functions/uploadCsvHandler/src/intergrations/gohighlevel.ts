import axios from 'axios';
import { config } from '../config';

export async function syncToGoHighLevel(lead: any) {
  if (!config.goHighLevelApiKey) return;

  try {
    // 🟢 NEW LOGIC: Extract from Arrays (with fallbacks)
    const primaryEmail =
      lead.emails && lead.emails.length > 0
        ? lead.emails[0]
        : `no-email-${Date.now()}@example.com`;

    const primaryPhone =
      lead.phones && lead.phones.length > 0 ? lead.phones[0] : null; // Don't send a fake phone, let GHL handle it or skip

    // If no phone and no email, GHL might reject it.
    if (!primaryEmail && !primaryPhone) {
      console.log('⚠️ Skipping GHL: No email or phone data.');
      return;
    }

    const payload = {
      locationId: 'mHaAy3ZaUHgrbPyughDG',
      firstName: lead.ownerFirstName || 'Unknown',
      lastName: lead.ownerLastName || 'Owner',

      // Use the extracted variables
      email: primaryEmail,
      phone: primaryPhone,

      address1: lead.ownerAddress,
      city: lead.ownerCity,
      state: lead.ownerState,
      postalCode: lead.ownerZip,
      country: 'US',
      source: 'CSV Upload',
      tags: ['Real Estate Lead', 'Preforeclosure'],
      dnd: false,
    };

    // Remove empty keys (e.g. if phone is null)
    if (!payload.phone) delete payload.phone;

    // Remove trailing slash
    const url = 'https://services.leadconnectorhq.com/contacts';

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.goHighLevelApiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Version: '2021-07-28',
      },
    });

    console.log('✅ Synced to GoHighLevel. ID:', res.data?.contact?.id);
  } catch (error: any) {
    const serverMsg =
      error.response?.data?.message || JSON.stringify(error.response?.data);
    // Ignore "Phone number already exists" errors if you want
    console.error(
      `❌ GoHighLevel sync failed (${error.response?.status}): ${serverMsg}`
    );
  }
}
