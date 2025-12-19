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
  lead_source_id: 'PBInTgsd2nMCD3Ngmy0a',
  lead_type: 'oaf4wCuM3Ub9eGpiddrO',
  skiptracestatus: 'HrnY1GUZ7P6d6r7J0ZRc',
  phone_2: 'LkmfM0Va5PylJFsJYjCu',
  phone_3: 'Cu6zwsuWrxoVWdxySc6t',
  phone_4: 'hxwJG0lYeV18IxxWh09H',
  phone_5: '8fIoSV1W05ciIrn01QT0',
  email_2: 'JY5nf3NzRwfCGvN5u00E',
  email_3: '1oy6TLKItn5RkebjI7kD',
};

const GHL_API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

const createGhlClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
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

export async function syncToGoHighLevel(lead: DBLead): Promise<string> {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY is missing.');
  const ghl = createGhlClient();

  try {
    const primaryEmail = lead.emails?.[0]?.toLowerCase() || null;
    const primaryPhone = lead.phones || lead.phones?.[0] || null;

    // 🎯 FIX: Explicitly map DB fields to GHL Custom Field IDs
    const customFieldValues: Record<string, any> = {
      property_address: lead.ownerAddress,
      property_city: lead.ownerCity,
      property_state: lead.ownerState,
      property_zip: lead.ownerZip,
      mailing_address: lead.mailingAddress,
      mailing_city: lead.mailingCity,
      mailing_state: lead.mailingState,
      mailing_zipcode: lead.mailingZip,
      lead_type: lead.type,
      skiptracestatus: lead.skipTraceStatus?.toUpperCase() || 'PENDING',
    };

    // 🎯 FIX: Map additional phones (up to 5)
    if (lead.phones && lead.phones.length > 1) {
      lead.phones.slice(1, 5).forEach((p, idx) => {
        customFieldValues[`phone_${idx + 2}`] = p;
      });
    }

    // 🎯 FIX: Map additional emails
    if (lead.emails && lead.emails.length > 1) {
      lead.emails.slice(1, 3).forEach((e, idx) => {
        customFieldValues[`email_${idx + 2}`] = e;
      });
    }

    const customFields = Object.keys(customFieldValues)
      .filter((key) => customFieldValues[key] && GHL_CUSTOM_FIELD_ID_MAP[key])
      .map((key) => ({
        id: GHL_CUSTOM_FIELD_ID_MAP[key],
        field_value: String(customFieldValues[key]),
      }));

    const basePayload = {
      firstName: lead.ownerFirstName || 'Unknown',
      lastName: lead.ownerLastName || 'Owner',
      // 🎯 FIX: Removed fake email placeholder
      email: primaryEmail,
      phone: primaryPhone,
      tags: lead.leadLabels || ['Start Dialing Campaign'],
      source: 'JTR_SkipTrace_App',
      customFields,
    };

    const performUpdate = async (ghlId: string, currentRecord?: any) => {
      console.info(`🔄 Updating contact: ${ghlId}`);
      const res = await ghl.put(`/contacts/${ghlId}`, basePayload);
      return res.data?.contact?.id || ghlId;
    };

    if (lead.ghlContactId) {
      console.info(`🎯 Stored GHL ID found: ${lead.ghlContactId}`);
      return await performUpdate(lead.ghlContactId);
    }

    let existingContact: any = null;
    if (primaryEmail || primaryPhone) {
      const searchBody = {
        locationId: LOCATION_ID,
        pageLimit: 1,
        filters: [
          {
            group: 'OR',
            filters: [
              ...(primaryEmail
                ? [{ field: 'email', operator: 'eq', value: primaryEmail }]
                : []),
              ...(primaryPhone
                ? [{ field: 'phone', operator: 'eq', value: primaryPhone }]
                : []),
            ],
          },
        ],
      };
      const searchRes = await ghl.post('/contacts/search', searchBody);
      if (searchRes.data?.contacts?.length > 0) {
        existingContact = searchRes.data.contacts[0];
      }
    }

    if (existingContact) return await performUpdate(existingContact.id);

    console.info(`🆕 Creating new contact`);
    const res = await ghl.post('/contacts/', {
      ...basePayload,
      locationId: LOCATION_ID,
    });
    return res.data?.contact?.id;
  } catch (error: any) {
    throw new Error(
      `GHL sync failed: ${error.response?.data?.message || error.message}`
    );
  }
}
