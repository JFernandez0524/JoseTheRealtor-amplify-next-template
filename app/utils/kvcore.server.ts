/**
 * kvCORE/BoldTrail API Client
 * 
 * Provides contact management, communication, and saved search functionality
 * for RE/MAX agents. Does NOT include MLS listing search (use ChatGPT's Zillow instead).
 * 
 * API Documentation: https://api.kvcore.com/docs
 * Base URL: https://api.kvcore.com/v2
 * Authentication: Bearer Token (JWT)
 * 
 * AVAILABLE ENDPOINTS:
 * - Contact Management (create, update, get, delete)
 * - Contact Communication (email, SMS, calls, notes)
 * - Contact Listing Search Alerts (saved searches)
 * - Open Houses (get by date range)
 * - Manual Listings (your own listings only)
 * 
 * NOT AVAILABLE:
 * - MLS listing search (use ChatGPT's Zillow tool instead)
 * 
 * ENVIRONMENT VARIABLES:
 * - KVCORE_API_KEY: JWT token from kvCORE
 */

import axios, { AxiosInstance } from 'axios';

const KVCORE_API_KEY = process.env.KVCORE_API_KEY;
const KVCORE_BASE_URL = 'https://api.kvcore.com/v2';

function isKvCoreEnabled(): boolean {
  if (!KVCORE_API_KEY) {
    console.log('⏭️ Skipping kvCORE operation - API key not configured');
    return false;
  }
  return true;
}

if (!KVCORE_API_KEY) {
  console.warn('⚠️ KVCORE_API_KEY not configured');
}

const kvCoreClient: AxiosInstance = axios.create({
  baseURL: KVCORE_BASE_URL,
  headers: {
    'Authorization': `Bearer ${KVCORE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// ============================================
// CONTACT MANAGEMENT
// ============================================

/**
 * Create a new contact
 * Endpoint: POST /public/contacts
 */
export async function createContact(contact: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dealType?: 'buyer' | 'seller' | 'buyer,seller';
  source?: string;
  notes?: string;
  tags?: string[];
}) {
  if (!isKvCoreEnabled()) return null;

  try {
    console.log('👤 Creating kvCORE contact:', contact.email);
    
    const response = await kvCoreClient.post('/public/contacts', {
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      deal_type: contact.dealType || 'buyer,seller',
      source: contact.source || 'AI Chat',
      notes: contact.notes,
      tags: contact.tags
    });

    console.log('✅ Contact created:', response.data.id);
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE create contact error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get contacts list
 * Endpoint: GET /public/contacts
 */
export async function getContacts(params?: {
  page?: number;
  perPage?: number;
  search?: string;
  dealType?: 'buyer' | 'seller';
}) {
  if (!isKvCoreEnabled()) return { data: [], total: 0 };

  try {
    console.log('📇 Fetching kvCORE contacts');
    
    const response = await kvCoreClient.get('/public/contacts', {
      params: {
        page: params?.page || 1,
        per_page: params?.perPage || 100,
        search: params?.search,
        deal_type: params?.dealType
      }
    });

    console.log(`✅ Found ${response.data.total} contacts`);
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE get contacts error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get contact details
 * Endpoint: GET /public/contacts/{id}
 */
export async function getContactDetails(contactId: string) {
  if (!KVCORE_API_KEY) {
    console.log('⏭️ Skipping kvCORE contact details - API key not configured');
    return null;
  }

  try {
    console.log('👤 Fetching contact details:', contactId);
    
    const response = await kvCoreClient.get(`/public/contacts/${contactId}`);
    
    console.log('✅ Contact details retrieved');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE get contact error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Update contact
 * Endpoint: PUT /public/contacts/{id}
 */
export async function updateContact(contactId: string, updates: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dealType?: 'buyer' | 'seller' | 'buyer,seller';
  notes?: string;
  status?: string;
}) {
  if (!KVCORE_API_KEY) {
    console.log('⏭️ Skipping kvCORE contact update - API key not configured');
    return null;
  }

  try {
    console.log('📝 Updating kvCORE contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}`, {
      first_name: updates.firstName,
      last_name: updates.lastName,
      email: updates.email,
      phone: updates.phone,
      deal_type: updates.dealType,
      notes: updates.notes,
      status: updates.status
    });

    console.log('✅ Contact updated');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE update contact error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Delete contact
 * Endpoint: DELETE /public/contacts/{id}
 */
export async function deleteContact(contactId: string) {
  if (!KVCORE_API_KEY) {
    console.log('⏭️ Skipping kvCORE contact deletion - API key not configured');
    return false;
  }

  try {
    console.log('🗑️ Deleting kvCORE contact:', contactId);
    
    await kvCoreClient.delete(`/public/contacts/${contactId}`);
    
    console.log('✅ Contact deleted');
    return true;
  } catch (error: any) {
    console.error('❌ kvCORE delete contact error:', error.response?.data || error.message);
    return false;
  }
}

// ============================================
// CONTACT COMMUNICATION
// ============================================

/**
 * Send email to contact
 * Endpoint: PUT /public/contacts/{id}/send-email
 */
export async function sendEmailToContact(contactId: string, email: {
  subject: string;
  body: string;
  fromEmail?: string;
}) {
  if (!KVCORE_API_KEY) {
    console.log('⏭️ Skipping kvCORE email send - API key not configured');
    return null;
  }

  try {
    console.log('📧 Sending email to contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/send-email`, {
      subject: email.subject,
      body: email.body,
      from_email: email.fromEmail
    });

    console.log('✅ Email sent');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE send email error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Send text/SMS to contact
 * Endpoint: PUT /public/contacts/{id}/send-text
 */
export async function sendTextToContact(contactId: string, message: string) {
  try {
    console.log('💬 Sending text to contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/send-text`, {
      message: message
    });

    console.log('✅ Text sent');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE send text error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Add note to contact
 * Endpoint: PUT /public/contacts/{id}/notes
 */
export async function addNoteToContact(contactId: string, note: string) {
  try {
    console.log('📝 Adding note to contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/notes`, {
      note: note
    });

    console.log('✅ Note added');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE add note error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Log a call with contact
 * Endpoint: PUT /public/contacts/{id}/calls
 */
export async function logCall(contactId: string, call: {
  duration?: number;
  notes?: string;
  outcome?: string;
}) {
  try {
    console.log('📞 Logging call for contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/calls`, {
      duration: call.duration,
      notes: call.notes,
      outcome: call.outcome
    });

    console.log('✅ Call logged');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE log call error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Schedule a call with contact
 * Endpoint: POST /public/contacts/{id}/schedule-call
 */
export async function scheduleCall(contactId: string, call: {
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
}) {
  try {
    console.log('📅 Scheduling call for contact:', contactId);
    
    const response = await kvCoreClient.post(`/public/contacts/${contactId}/schedule-call`, {
      scheduled_date: call.scheduledDate,
      scheduled_time: call.scheduledTime,
      notes: call.notes
    });

    console.log('✅ Call scheduled');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE schedule call error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Submit showing request
 * Endpoint: POST /public/contacts/{id}/showing-request
 */
export async function submitShowingRequest(contactId: string, request: {
  propertyAddress: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
}) {
  try {
    console.log('🏡 Submitting showing request for contact:', contactId);
    
    const response = await kvCoreClient.post(`/public/contacts/${contactId}/showing-request`, {
      property_address: request.propertyAddress,
      preferred_date: request.preferredDate,
      preferred_time: request.preferredTime,
      notes: request.notes
    });

    console.log('✅ Showing request submitted');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE showing request error:', error.response?.data || error.message);
    return null;
  }
}

// ============================================
// CONTACT TAGS
// ============================================

/**
 * Add tags to contact
 * Endpoint: PUT /public/contacts/{id}/tags
 */
export async function addTagsToContact(contactId: string, tags: string[]) {
  try {
    console.log('🏷️ Adding tags to contact:', contactId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/tags`, {
      tags: tags
    });

    console.log('✅ Tags added');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE add tags error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Remove tags from contact
 * Endpoint: DELETE /public/contacts/{id}/tags
 */
export async function removeTagsFromContact(contactId: string, tags: string[]) {
  try {
    console.log('🏷️ Removing tags from contact:', contactId);
    
    await kvCoreClient.delete(`/public/contacts/${contactId}/tags`, {
      data: { tags: tags }
    });

    console.log('✅ Tags removed');
    return true;
  } catch (error: any) {
    console.error('❌ kvCORE remove tags error:', error.response?.data || error.message);
    return false;
  }
}

// ============================================
// CONTACT LISTING SEARCH ALERTS (Saved Searches)
// ============================================

/**
 * Add search alert to contact
 * Endpoint: POST /public/contact/{contactId}/searchalert
 */
export async function addSearchAlert(contactId: string, alert: {
  number?: 1 | 2; // ID of search alert (1 or 2)
  active?: number; // Active status
  areas?: Array<{
    type: string; // zip, city, neighborhood
    name: string; // Value of the type
  }>;
  types: string[]; // Listing types (required)
  options?: string[];
  beds?: number;
  baths?: number;
  minPrice?: number;
  maxPrice?: number;
  minAcres?: number;
  maxAcres?: number;
  minSqft?: number;
  maxSqft?: number;
  minYear?: number;
  maxYear?: number;
  frequency?: string; // daily, weekly, instant
  emailCc?: string;
}) {
  try {
    console.log('💾 Adding search alert for contact:', contactId);
    
    const response = await kvCoreClient.post(`/public/contact/${contactId}/searchalert`, {
      number: alert.number || 1,
      active: alert.active,
      areas: alert.areas,
      types: alert.types,
      options: alert.options,
      beds: alert.beds,
      baths: alert.baths,
      min_price: alert.minPrice,
      max_price: alert.maxPrice,
      min_acres: alert.minAcres,
      max_acres: alert.maxAcres,
      min_sqft: alert.minSqft,
      max_sqft: alert.maxSqft,
      min_year: alert.minYear,
      max_year: alert.maxYear,
      frequency: alert.frequency,
      email_cc: alert.emailCc
    });

    console.log('✅ Search alert added');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE add search alert error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get contact's search alerts
 * Endpoint: GET /public/contacts/{contactId}/search-alerts
 */
export async function getSearchAlerts(contactId: string) {
  try {
    console.log('📋 Fetching search alerts for contact:', contactId);
    
    const response = await kvCoreClient.get(`/public/contacts/${contactId}/search-alerts`);
    
    console.log(`✅ Found ${response.data.length} search alerts`);
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE get search alerts error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Update search alert
 * Endpoint: PUT /public/contacts/{contactId}/search-alerts/{alertId}
 */
export async function updateSearchAlert(contactId: string, alertId: string, updates: {
  active?: number;
  beds?: number;
  baths?: number;
  minPrice?: number;
  maxPrice?: number;
  frequency?: string;
}) {
  try {
    console.log('📝 Updating search alert:', alertId);
    
    const response = await kvCoreClient.put(`/public/contacts/${contactId}/search-alerts/${alertId}`, {
      active: updates.active,
      beds: updates.beds,
      baths: updates.baths,
      min_price: updates.minPrice,
      max_price: updates.maxPrice,
      frequency: updates.frequency
    });

    console.log('✅ Search alert updated');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE update search alert error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Delete search alert
 * Endpoint: DELETE /public/contacts/{contactId}/search-alerts/{alertId}
 */
export async function deleteSearchAlert(contactId: string, alertId: string) {
  try {
    console.log('🗑️ Deleting search alert:', alertId);
    
    await kvCoreClient.delete(`/public/contacts/${contactId}/search-alerts/${alertId}`);
    
    console.log('✅ Search alert deleted');
    return true;
  } catch (error: any) {
    console.error('❌ kvCORE delete search alert error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Send search alert results to contact
 * Endpoint: POST /public/contact/{contactId}/searchalert/{searchAlertNumber}
 * 
 * Manually trigger sending of saved search results to contact via email.
 * This sends them matching listings based on their saved search criteria.
 */
export async function sendSearchAlertResults(contactId: string, searchAlertNumber: 1 | 2) {
  try {
    console.log('📧 Sending search alert results to contact:', contactId);
    
    const response = await kvCoreClient.post(
      `/public/contact/${contactId}/searchalert/${searchAlertNumber}`
    );

    console.log('✅ Search alert results sent');
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE send search alert error:', error.response?.data || error.message);
    return null;
  }
}

// ============================================
// OPEN HOUSES
// ============================================

/**
 * Get open houses in date range
 * Endpoint: GET /public/open-houses
 */
export async function getOpenHouses(params: {
  startDate: string;
  endDate: string;
}) {
  try {
    console.log('🏡 Fetching open houses');
    
    const response = await kvCoreClient.get('/public/open-houses', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate
      }
    });

    console.log(`✅ Found ${response.data.length} open houses`);
    return response.data;
  } catch (error: any) {
    console.error('❌ kvCORE open houses error:', error.response?.data || error.message);
    return null;
  }
}


