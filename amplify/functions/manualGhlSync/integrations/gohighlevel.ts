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
  lead_source_id: 'PBInTgsd2nMCD3Ngmy0a', // 🎯 Used for Sibling Suppression
  lead_type: 'oaf4wCuM3Ub9eGpiddrO',
  contact_type: 'pGfgxcdFaYAkdq0Vp53j', // Phone Contact vs Direct Mail
  skiptracestatus: 'HrnY1GUZ7P6d6r7J0ZRc',
  phone_2: 'LkmfM0Va5PylJFsJYjCu',
  phone_3: 'Cu6zwsuWrxoVWdxySc6t',
  phone_4: 'hxwJG0lYeV18IxxWh09H',
  phone_5: '8fIoSV1W05ciIrn01QT0',
  email_2: 'JY5nf3NzRwfCGvN5u00E',
  email_3: '1oy6TLKItn5RkebjI7kD',
  // 🆕 NEW APP CONTROL FIELDS
  app_user_id: 'CNoGugInWOC59hAPptxY',
  app_plan: 'YEJuROSCNnG9OXi3K8lb',
  app_account_status: 'diShiF2bpX7VFql08MVN',
  app_lead_id: 'aBlDP8DU3dFSHI2LFesn',
  ai_state: '1NxQW2kKMVgozjSUuu7s',
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
      Version: '2021-07-28', // 🚨 CRITICAL: GHL Version header
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

// 🎯 Updated parameters for "1 Phone = 1 Contact" strategy
export async function syncToGoHighLevel(
  lead: DBLead,
  specificPhone: string,
  phoneIndex: number,
  isPrimary: boolean,
  userGroups: string[] = [],
  userId: string = ''
): Promise<string> {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY is missing.');
  const ghl = createGhlClient();

  try {
    const primaryEmail = lead.emails?.[0]?.toLowerCase() || null;

    // 🆕 Determine user plan and account status
    const isAIPlan = userGroups.includes('AI_PLAN');
    const isPROPlan = userGroups.includes('PRO');
    const isAdmin = userGroups.includes('ADMINS');
    
    const appPlan = isAIPlan ? 'AI' : isPROPlan ? 'SYNC' : 'SYNC'; // Default to SYNC for paid users
    const appAccountStatus = 'active'; // TODO: Add billing status check for 'past_due'/'canceled'

    // 🎯 Construct Custom Field Values
    const customFieldValues: Record<string, any> = {
      property_address: lead.ownerAddress,
      property_city: lead.ownerCity,
      property_state: lead.ownerState,
      property_zip: lead.ownerZip,
      mailing_address: lead.mailingAddress,
      mailing_city: lead.mailingCity,
      mailing_state: lead.mailingState,
      mailing_zipcode: lead.mailingZip,
      lead_type: lead.type === 'PROBATE' ? 'Probate' : lead.type === 'PREFORECLOSURE' ? 'Preforeclosure' : lead.type,
      contact_type: specificPhone ? 'Phone Contact' : 'Direct Mail',
      skiptracestatus: lead.skipTraceStatus?.toUpperCase() || 'PENDING',
      lead_source_id: lead.id, // 🎯 Shared Lead ID for suppression workflows
      // 🆕 APP CONTROL FIELDS
      app_user_id: userId,
      app_plan: appPlan,
      app_account_status: appAccountStatus,
      app_lead_id: lead.id,
      ai_state: isAIPlan ? 'not_started' : 'not_started', // Always start with not_started
    };

    const customFields = Object.keys(customFieldValues)
      .filter((key) => customFieldValues[key] && GHL_CUSTOM_FIELD_ID_MAP[key])
      .map((key) => ({
        id: GHL_CUSTOM_FIELD_ID_MAP[key],
        value: String(customFieldValues[key]), // Use 'value' not 'field_value'
      }));

    // 🎯 Define Tags based on primary status and phone eligibility
    const tags = [...(lead.leadLabels || [])];
    
    // 🆕 APP CONTROL TAGS (source of truth)
    tags.push('App:Synced');
    if (isAIPlan) tags.push('App:AI-Enabled');
    
    // 📊 DATA SOURCE TRACKING
    if (lead.skipTraceStatus === 'COMPLETED') {
      tags.push('Data:SkipTraced'); // Phone/email from skip trace
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
    
    if (isCallable) {
      tags.push('Multi-Phone-Lead');
      tags.push('start dialing campaign'); // 🎯 TRIGGER TAG for Dialer Logic: Weekly 8x Loop
    } else if (specificPhone) {
      // Has phone but not callable (failed skip trace, DNC, etc.)
      tags.push('Multi-Phone-Lead');
      tags.push('Direct-Mail-Only'); // Route to mail instead
    } else {
      // No phone at all
      tags.push('Direct-Mail-Only');
    }
    
    // 🛡️ DIRECT MAIL PROTECTION - Only ONE sibling gets mail eligibility
    if (isPrimary) {
      tags.push('Direct_Mail_Eligible');
      tags.push('Primary_Contact');
    }

    const basePayload = {
      firstName: lead.adminFirstName || lead.ownerFirstName || 'Unknown',
      lastName: `${lead.adminLastName || lead.ownerLastName || 'Owner'}${specificPhone ? ` (${phoneIndex})` : ''}`,
      email: isPrimary ? primaryEmail : undefined, // Attach email only to primary to avoid duplicates
      phone: specificPhone || undefined, // Don't send empty phone
      tags,
      source: 'JTR_SkipTrace_App',
      customFields,
    };

    const performUpdate = async (ghlId: string) => {
      console.info(`🔄 Updating contact ${ghlId}${specificPhone ? ` with phone ${specificPhone}` : ' (direct mail only)'}`);
      const res = await ghl.put(`/contacts/${ghlId}`, basePayload);
      return res.data?.contact?.id || ghlId;
    };

    // 🎯 SEARCH: Find existing contact
    let existingContact: any = null;
    
    if (specificPhone) {
      // Search by phone if available
      const searchBody = {
        locationId: LOCATION_ID,
        pageLimit: 1,
        filters: [{ field: 'phone', operator: 'eq', value: specificPhone }],
      };
      const searchRes = await ghl.post('/contacts/search', searchBody);
      if (searchRes.data?.contacts?.length > 0) {
        existingContact = searchRes.data.contacts[0];
      }
    } else {
      // Search by email or name for direct mail leads
      if (primaryEmail) {
        const searchBody = {
          locationId: LOCATION_ID,
          pageLimit: 1,
          filters: [{ field: 'email', operator: 'eq', value: primaryEmail }],
        };
        const searchRes = await ghl.post('/contacts/search', searchBody);
        if (searchRes.data?.contacts?.length > 0) {
          existingContact = searchRes.data.contacts[0];
        }
      }
    }

    if (existingContact) return await performUpdate(existingContact.id);

    console.info(
      `🆕 Creating new contact${specificPhone ? ` for phone ${phoneIndex}: ${specificPhone}` : ' for direct mail workflow'}`
    );
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
