import axios from 'axios';

const GHL_API = 'https://services.leadconnectorhq.com';

type FieldDef = { name: string; dataType: string; picklistOptions?: string[] };

const CONTACT_FIELDS: Array<{ key: string } & FieldDef> = [
  { key: 'property_address',        name: 'Property Address',        dataType: 'TEXT' },
  { key: 'property_city',           name: 'Property City',           dataType: 'TEXT' },
  { key: 'property_state',          name: 'Property State',          dataType: 'TEXT' },
  { key: 'property_zip',            name: 'Property Zip',            dataType: 'TEXT' },
  { key: 'property_county',         name: 'Property County',         dataType: 'TEXT' },
  { key: 'mailing_address',         name: 'Mailing Address',         dataType: 'TEXT' },
  { key: 'mailing_city',            name: 'Mailing City',            dataType: 'TEXT' },
  { key: 'mailing_state',           name: 'Mailing State',           dataType: 'TEXT' },
  { key: 'mailing_zipcode',         name: 'Mailing Zipcode',         dataType: 'TEXT' },
  {
    key: 'lead_type',
    name: 'Lead Type',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['PREFORECLOSURE', 'PROBATE'],
  },
  { key: 'contact_type',            name: 'Contact Type',            dataType: 'TEXT' },
  { key: 'skiptracestatus',         name: 'SkipTrace Status',        dataType: 'TEXT' },
  { key: 'listing_status',          name: 'Listing Status',          dataType: 'TEXT' },
  { key: 'zestimate',               name: 'Zestimate',               dataType: 'NUMERICAL' },
  { key: 'cash_offer',              name: 'Cash Offer',              dataType: 'NUMERICAL' },
  { key: 'call_attempt_counter',    name: 'Call Attempt Counter',    dataType: 'NUMERICAL' },
  { key: 'email_attempt_counter',   name: 'Email Attempt Counter',   dataType: 'NUMERICAL' },
  { key: 'mail_sent_count',         name: 'Mail Sent Count',         dataType: 'NUMERICAL' },
  { key: 'qr_scan_count',           name: 'QR Scan Count',           dataType: 'NUMERICAL' },
  { key: 'last_call_date',          name: 'Last Call Date',          dataType: 'TEXT' },
  { key: 'last_email_date',         name: 'Last Email Date',         dataType: 'TEXT' },
  { key: 'last_mail_date',          name: 'Last Mail Date',          dataType: 'TEXT' },
  { key: 'mail_delivery_date',      name: 'Mail Delivery Date',      dataType: 'TEXT' },
  { key: 'phone_2',                 name: 'Phone 2',                 dataType: 'TEXT' },
  { key: 'phone_3',                 name: 'Phone 3',                 dataType: 'TEXT' },
  { key: 'phone_4',                 name: 'Phone 4',                 dataType: 'TEXT' },
  { key: 'phone_5',                 name: 'Phone 5',                 dataType: 'TEXT' },
  { key: 'email_2',                 name: 'Email 2',                 dataType: 'TEXT' },
  { key: 'email_3',                 name: 'Email 3',                 dataType: 'TEXT' },
  { key: 'app_user_id',             name: 'App User ID',             dataType: 'TEXT' },
  { key: 'app_plan',                name: 'App Plan',                dataType: 'TEXT' },
  { key: 'app_account_status',      name: 'App Account Status',      dataType: 'TEXT' },
  { key: 'app_lead_id',             name: 'App Lead ID',             dataType: 'TEXT' },
  {
    key: 'ai_state',
    name: 'AI State',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['not_started', 'running', 'stopped', 'paused', 'handoff', 'IDENTITY_CONFIRMATION'],
  },
  { key: 'lead_source_id',          name: 'Lead Source ID',          dataType: 'TEXT' },
  {
    key: 'conversation_sentiment',
    name: 'Conversation Sentiment',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['POSITIVE', 'NEUTRAL', 'FRUSTRATED', 'URGENT', 'DISENGAGING'],
  },
  { key: 'property_tier',           name: 'Property Tier',           dataType: 'TEXT' },
  { key: 'zillow_link',             name: 'Zillow Link',             dataType: 'LARGE_TEXT' },
  {
    key: 'call_outcome',
    name: 'Call Outcome',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: [
      'No Answer',
      'Voicemail',
      'Follow Up',
      'Requested Appointment',
      'Not Interested',
      'Incorrect Number',
      'Listed With Realtor',
      'Sold Already',
      'DNC',
      'DEAD / Never Responded',
    ],
  },
];

const OPPORTUNITY_FIELDS: Array<{ key: string } & FieldDef> = [
  {
    key: 'disposition',
    name: 'Disposition',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: [
      'New Lead',
      'Attempting Contact',
      'Contact Made',
      'Appointment Set',
      'Offer Made',
      'Under Contract',
      'Closed',
      'Not Interested',
      'Wrong Number',
      'Direct Mail Campaign',
      'Dead',
    ],
  },
];

const CALL_DISPOSITIONS = [
  'No Answer',
  'Voicemail',
  'Follow Up',
  'Requested Appointment',
  'Not Interested',
  'Incorrect Number',
  'Listed With Realtor',
  'Sold Already',
  'DNC',
];

async function fetchExistingContactFields(locationId: string, token: string): Promise<Array<{ id: string; name: string }>> {
  const res = await axios.get(`${GHL_API}/locations/${locationId}/customFields`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    params: { model: 'contact' },
  });
  return res.data?.customFields || [];
}

async function fetchExistingOpportunityFields(locationId: string, token: string): Promise<Array<{ id: string; name: string }>> {
  const res = await axios.get(`${GHL_API}/locations/${locationId}/customFields`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    params: { model: 'opportunity' },
  });
  return res.data?.customFields || [];
}

async function createField(
  locationId: string,
  token: string,
  name: string,
  dataType: string,
  model: 'contact' | 'opportunity',
  picklistOptions?: string[]
): Promise<string> {
  const body: Record<string, any> = { name, dataType, model };
  if (picklistOptions?.length) {
    body.picklistOptions = picklistOptions;
  }
  const res = await axios.post(
    `${GHL_API}/locations/${locationId}/customFields`,
    body,
    { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' } }
  );
  return res.data?.customField?.id || res.data?.id;
}

export async function provisionCallDispositions(locationId: string, token: string): Promise<void> {
  console.log(`🔧 [PROVISIONER] Provisioning call dispositions for location ${locationId}`);

  let existing: Array<{ id: string; name: string }> = [];
  try {
    const res = await axios.get(`${GHL_API}/locations/${locationId}/call-dispositions`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    });
    existing = res.data?.callDispositions ?? res.data ?? [];
    if (!Array.isArray(existing)) {
      console.error('❌ [PROVISIONER] Unexpected call-dispositions response shape:', JSON.stringify(res.data).slice(0, 300));
      existing = [];
    }
  } catch (err: any) {
    console.error('❌ [PROVISIONER] Failed to fetch call dispositions:', err.response?.data || err.message);
    return;
  }

  const existingNames = new Set(existing.map((d) => d.name.toLowerCase().trim()));

  for (const name of CALL_DISPOSITIONS) {
    if (existingNames.has(name.toLowerCase().trim())) {
      console.log(`✅ [PROVISIONER] Call disposition "${name}" already exists`);
      continue;
    }
    try {
      await axios.post(
        `${GHL_API}/locations/${locationId}/call-dispositions`,
        { name },
        { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' } }
      );
      console.log(`🆕 [PROVISIONER] Created call disposition "${name}"`);
    } catch (err: any) {
      console.error(`❌ [PROVISIONER] Failed to create call disposition "${name}":`, err.response?.data || err.message);
    }
  }

  console.log(`✅ [PROVISIONER] Call disposition provisioning complete`);
}

export async function provisionCustomFields(locationId: string, token: string): Promise<Record<string, string>> {
  console.log(`🔧 [PROVISIONER] Provisioning contact custom fields for location ${locationId}`);
  const existing = await fetchExistingContactFields(locationId, token);
  const existingByName = new Map(existing.map(f => [f.name.toLowerCase().trim(), f.id]));

  const result: Record<string, string> = {};

  for (const field of CONTACT_FIELDS) {
    const existingId = existingByName.get(field.name.toLowerCase().trim());
    if (existingId) {
      result[field.key] = existingId;
      console.log(`✅ [PROVISIONER] Field "${field.name}" already exists: ${existingId}`);
    } else {
      try {
        const newId = await createField(locationId, token, field.name, field.dataType, 'contact', field.picklistOptions);
        result[field.key] = newId;
        console.log(`🆕 [PROVISIONER] Created field "${field.name}": ${newId}`);
      } catch (err: any) {
        console.error(`❌ [PROVISIONER] Failed to create field "${field.name}":`, err.response?.data || err.message);
      }
    }
  }

  console.log(`✅ [PROVISIONER] Contact field provisioning complete (${Object.keys(result).length}/${CONTACT_FIELDS.length} fields)`);
  return result;
}

export async function provisionOpportunityFields(locationId: string, token: string): Promise<Record<string, string>> {
  console.log(`🔧 [PROVISIONER] Provisioning opportunity custom fields for location ${locationId}`);
  const existing = await fetchExistingOpportunityFields(locationId, token);
  const existingByName = new Map(existing.map(f => [f.name.toLowerCase().trim(), f.id]));

  const result: Record<string, string> = {};

  for (const field of OPPORTUNITY_FIELDS) {
    const existingId = existingByName.get(field.name.toLowerCase().trim());
    if (existingId) {
      result[field.key] = existingId;
    } else {
      try {
        const newId = await createField(locationId, token, field.name, field.dataType, 'opportunity', field.picklistOptions);
        result[field.key] = newId;
        console.log(`🆕 [PROVISIONER] Created opportunity field "${field.name}": ${newId}`);
      } catch (err: any) {
        console.error(`❌ [PROVISIONER] Failed to create opportunity field "${field.name}":`, err.response?.data || err.message);
      }
    }
  }

  return result;
}
