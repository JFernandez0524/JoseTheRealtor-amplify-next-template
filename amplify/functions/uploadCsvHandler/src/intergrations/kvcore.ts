import axios from 'axios';
import { config } from '../config';

export async function syncToKVCore(lead: any) {
  if (!config.kvcoreApiKey) {
    console.warn('KVCore integration disabled — missing API key');
    return;
  }

  try {
    const payload = {
      firstName: lead.executorFirstName || lead.borrowerFirstName,
      lastName: lead.executorLastName || lead.borrowerLastName,
      email: lead.email,
      phone: lead.phone,
      address: `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`,
    };

    const res = await axios.post(
      'https://api.insiderealestate.com/v1/contacts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.kvcoreApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Synced to KVCore:', res.status);
  } catch (error: any) {
    console.error('❌ KVCore sync failed:', error.message);
  }
}
