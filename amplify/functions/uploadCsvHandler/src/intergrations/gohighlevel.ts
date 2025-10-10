import axios from 'axios';
import { config } from '../config';

export async function syncToGoHighLevel(lead: any) {
  if (!config.goHighLevelApiKey) {
    console.warn('GoHighLevel integration disabled — missing API key');
    return;
  }

  try {
    const payload = {
      firstName: lead.executorFirstName,
      lastName: lead.executorLastName,
      email: lead.email,
      phone: lead.phone,
      tags: ['Real Estate Lead'],
    };

    const res = await axios.post(
      'https://rest.gohighlevel.com/v1/contacts/',
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.goHighLevelApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Synced to GoHighLevel:', res.status);
  } catch (error: any) {
    console.error('❌ GoHighLevel sync failed:', error.message);
  }
}
