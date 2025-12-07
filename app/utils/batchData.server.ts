import axios from 'axios';

// --- Types ---

// 1. Request Type
export type LeadToSkip = {
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  name?: {
    first: string;
    last: string;
  };
};

// 2. Parsed Output Type (Matches your Schema)
export type FormattedContact = {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phones: Array<{
    number: string;
    type: string;
    carrier?: string;
    dnc?: boolean;
    tcpa?: boolean;
  }>;
  emails: Array<{ email: string; tested?: boolean }>;
  addresses: Array<{
    fullAddress: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    type: string;
  }>;
  litigator?: boolean;
  deceased?: boolean;
};

/**
 * Create a shared Axios instance for BatchData API
 */
const batchClient = axios.create({
  // Using the Mock Server ID you provided
  baseURL: 'https://stoplight.io/mocks/batchdata/batchdata/1354513859',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.BATCH_DATA_MOCK_TOKEN || 'mock-token'}`,
  },
  timeout: 15000, // 15s timeout
});

/**
 * ✅ HELPER: Parse the deep BatchData V3 response into clean contacts
 */
function parseBatchDataResponse(apiResponse: any): FormattedContact[] {
  // 1. Safely access the first result (since we send 1 request at a time)
  const resultData = apiResponse.result?.data?.[0];

  if (!resultData || !resultData.persons) {
    return [];
  }

  // 2. Map 'persons' to our clean format
  return resultData.persons.map((person: any) => ({
    firstName: person.name?.first,
    lastName: person.name?.last,
    middleName: person.name?.middle,

    // Map Phones (Preserve metadata like Carrier/Type)
    phones:
      person.phones?.map((p: any) => ({
        number: p.number,
        type: p.type,
        carrier: p.carrier,
        dnc: p.dnc,
        tcpa: p.tcpa,
      })) || [],

    // Map Emails
    emails:
      person.emails?.map((e: any) => ({
        email: e.email,
        tested: e.tested,
      })) || [],

    // Map Addresses (Capture all of them)
    addresses:
      person.addresses?.map((addr: any) => ({
        fullAddress: addr.fullAddress,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        type: addr.propertyMailingAddress ? 'Mailing' : 'Other',
      })) || [],

    // Flags
    litigator: person.litigator || false,
    deceased: person.deceased || false,
  }));
}

/**
 * ✅ Shared Skip Trace Logic
 * Handles calling the /property/skip-trace endpoint
 */
async function skipTraceProperty(leadToSkip: LeadToSkip) {
  try {
    const payload = {
      requests: [leadToSkip],
      // 👇 IMPORTANT: Filter DNC/TCPA numbers here
      options: {
        includeTCPABlacklistedPhones: false,
        prioritizeMobilePhones: true,
        matchHighQualityOnly: true,
      },
    };

    console.log('🔍 BatchData Request:', JSON.stringify(payload, null, 2));

    const { data } = await batchClient.post('/property/skip-trace', payload);

    // 👇 Parse and return clean data
    const contacts = parseBatchDataResponse(data);

    return {
      success: true,
      contacts: contacts,
      raw: data, // Keep raw data available just in case debugging is needed
    };
  } catch (error: any) {
    console.error('❌ BatchData skipTrace error:', error.message);
    if (error.response?.data) console.error(error.response.data);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ Wrapper for Pre-foreclosure (Targets Owner Address)
 */
export async function skipTracePreForeClosureSingleLead(
  leadToSkip: LeadToSkip
) {
  return skipTraceProperty(leadToSkip);
}

/**
 * ✅ Wrapper for Probate (Targets Executor/Admin Address)
 */
export async function skipTraceProbateSingleLead(leadToSkip: LeadToSkip) {
  return skipTraceProperty(leadToSkip);
}

/**
 * ✅ Verify Address (kept for reference)
 */
export async function verifyAddress(address: {
  address1: string;
  city: string;
  state: string;
  zip: string;
}) {
  try {
    const { data } = await batchClient.post('/address/verify', address);
    return data;
  } catch (error: any) {
    console.error('❌ BatchData verifyAddress error:', error.message);
    return null;
  }
}

/**
 * ✅ Normalize results (Optional Helper)
 */
export function normalizeAddressResult(result: any) {
  if (!result?.standardized_address) return null;
  return {
    address1: result.standardized_address.address1,
    city: result.standardized_address.city,
    state: result.standardized_address.state,
    zip: result.standardized_address.zip,
    country: result.standardized_address.country || 'US',
  };
}
