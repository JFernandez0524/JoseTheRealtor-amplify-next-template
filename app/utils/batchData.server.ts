import axios from 'axios';

// Define the shape of the request expected by BatchData
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

/**
 * Create a shared Axios instance for BatchData API
 */
const batchClient = axios.create({
  // 🛑 UPDATED: Using the specific Mock Server ID you provided
  baseURL: 'https://stoplight.io/mocks/batchdata/batchdata/1354513859',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Mock Token (can be anything for Stoplight, or your env var)
    Authorization: `Bearer ${process.env.BATCH_DATA_MOCK_TOKEN || 'mock-token'}`,
  },
  timeout: 15000, // 15 seconds
});

/**
 * ✅ Shared Skip Trace Logic
 * Handles calling the /property/skip-trace endpoint for any lead type
 */
async function skipTraceProperty(leadToSkip: LeadToSkip) {
  try {
    // The API expects an array of requests
    const payload = {
      requests: [leadToSkip],
    };

    console.log('🔍 BatchData Mock Request:', JSON.stringify(payload, null, 2));

    // Calls: https://stoplight.io/mocks/batchdata/batchdata/1354513859/property/skip-trace
    const { data } = await batchClient.post('/property/skip-trace', payload);
    return data;
  } catch (error: any) {
    console.error('❌ BatchData skipTrace error:', error.message);
    if (error.response?.data) console.error(error.response.data);
    return null;
  }
}

/**
 * ✅ Verify Address
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
 * ✅ Wrapper for Pre-foreclosure (Targets Owner Address)
 * REFACTORED: Now uses skip-trace to get contacts, not just property details
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
