import axios from 'axios';
import { config } from '../config';

export async function syncToKVCore(lead: any) {
  if (!config.kvcoreApiKey) return;

  try {
    // 🟢 NEW LOGIC: Extract from Arrays
    const primaryEmail =
      lead.emails && lead.emails.length > 0
        ? lead.emails[0]
        : `no-email-${Date.now()}@example.com`;

    const primaryPhone =
      lead.phones && lead.phones.length > 0 ? lead.phones[0] : null;

    // Shotgun Approach for Address (Send all keys)
    const pAddr = lead.ownerAddress || '';
    const pCity = lead.ownerCity || '';
    const pState = lead.ownerState || '';
    const pZip = lead.ownerZip || '';

    const payload = {
      first_name: lead.ownerFirstName || 'Unknown',
      last_name: lead.ownerLastName || 'Owner',

      // Use extracted variables
      email: primaryEmail,
      cell_phone_1: primaryPhone,
      phone_1: primaryPhone,

      // Address Shotgun
      address: pAddr,
      address_1: pAddr,
      primary_address: pAddr,
      city: pCity,
      primary_city: pCity,
      state: pState,
      primary_state: pState,
      zip: pZip,
      zip_code: pZip,
      postal_code: pZip,

      is_private: 0,
      deal_type: 'seller',
      status: 7,
      source: 'CSV Import',
      capture_method: 'Amplify Lambda',
      email_optin: 1,
      phone_on: 1,
      text_on: 1,
      hashtags: '#preforeclosure,#csv_import,#new_lead',
    };

    // Remove phone if null (KVCore hates empty strings)
    if (!payload.cell_phone_1) {
      delete payload.cell_phone_1;
      delete payload.phone_1;
    }

    const options = {
      method: 'POST',
      url: 'https://api.kvcore.com/v2/public/contact',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Bearer ${config.kvcoreApiKey}`,
      },
      data: payload,
    };

    const res = await axios.request(options);
    console.log('✅ Synced to KVCore. ID:', res.data?.data?.id || res.data?.id);
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message || JSON.stringify(error.response?.data);
    console.error(
      `❌ KVCore sync failed (${error.response?.status}): ${errorMsg}`
    );
  }
}
