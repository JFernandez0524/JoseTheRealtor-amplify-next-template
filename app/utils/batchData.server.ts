//app/utils/batchData.server.ts
import axios from 'axios';

import type { LeadToSkip } from '../types/batchdata/leadToSkip';

/**
 * Create a shared Axios instance for BatchData API
 */
const batchClient = axios.create({
  //production URL
  // baseURL: 'https://api.batchdata.com/api/v1',
  //mock URL
  baseURL: 'https://stoplight.io/mocks/batchdata/batchdata/20349728',
  headers: {
    'Content-Type': 'application/json',
    //Production Token
    // Authorization: `Bearer ${process.env.BATCH_DATA_SERVER_TOKEN}`,
    //Mock Token
    Authorization: `Bearer ${process.env.BATCH_DATA_MOCK_TOKEN}`,
  },
  timeout: 10000, // 10 seconds
});

/**
 * ✅ Verify an address with BatchData API
 * Docs: https://developer.batchdata.com/docs/batchdata/batchdata-v1/operations/create-a-address-verify
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
    if (error.response?.data) console.error(error.response.data);
    return null;
  }
}

/**
 * ✅ Property Lookup (for pre-foreclosure enrichment)
 * Docs: https://developer.batchdata.com/docs/batchdata/batchdata-v1/operations/create-a-property-lookup-async
 */
export async function skipTracePreForeClosureSingleLead(
  leadToSkip: LeadToSkip
) {
  const request: LeadToSkip[] = [];
  request.push(leadToSkip);
  if (!leadToSkip) throw new Error('leadToSkip is required');
  try {
    const { data } = await batchClient.post('/property/lookup/all-attributes', {
      request,
    });
    return data;
  } catch (error: any) {
    console.error('❌ BatchData propertyLookup error:', error.message);
    if (error.response?.data) console.error(error.response.data);
    return null;
  }
}

/**
 * ✅ Skip Trace (for probate leads)
 * Docs: https://developer.batchdata.com/docs/batchdata/batchdata-v1/operations/create-a-property-skip-trace
 */
export async function skipTraceProbateSingleLead(leadToSkip: LeadToSkip) {
  if (!leadToSkip) throw new Error('requests is required');
  const requests: LeadToSkip[] = [];
  requests.push(leadToSkip);
  try {
    const { data } = await batchClient.post('/property/skip-trace', {
      requests,
    });
    return data;
  } catch (error: any) {
    console.error('❌ BatchData skipTrace error:', error.message);
    if (error.response?.data) console.error(error.response.data);
    return null;
  }
}

/**
 * ✅ Normalize results into your app’s structure
 * Optional utility to clean up BatchData responses
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
