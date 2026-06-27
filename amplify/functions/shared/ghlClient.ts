/**
 * GHL API CLIENT
 *
 * Thin axios wrapper for the GoHighLevel (LeadConnector) REST API v2021-07-28.
 * All outbound GHL API calls in Lambda functions and API routes go through here.
 *
 * PATTERN:
 * - createGhlClient(token) → AxiosInstance (use for custom/one-off endpoints)
 * - Named helpers (ghlGetContact, ghlUpdateContact, etc.) for common operations
 *
 * BASE URL: https://services.leadconnectorhq.com
 * TIMEOUT: 10 seconds per request
 */
import axios, { AxiosInstance } from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export function createGhlClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: GHL_BASE_URL,
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: GHL_VERSION,
    },
  });
}

export async function ghlGetContact(token: string, contactId: string): Promise<any> {
  const ghl = createGhlClient(token);
  const res = await ghl.get(`/contacts/${contactId}`);
  return res.data?.contact ?? res.data;
}

export async function ghlUpdateContact(token: string, contactId: string, data: object): Promise<any> {
  const ghl = createGhlClient(token);
  const res = await ghl.put(`/contacts/${contactId}`, data);
  return res.data?.contact ?? res.data;
}

export async function ghlAddTags(token: string, contactId: string, tags: string[]): Promise<void> {
  const ghl = createGhlClient(token);
  await ghl.post(`/contacts/${contactId}/tags`, { tags });
}

export async function ghlRemoveTags(token: string, contactId: string, tags: string[]): Promise<void> {
  const ghl = createGhlClient(token);
  await ghl.delete(`/contacts/${contactId}/tags`, { data: { tags } });
}

export async function ghlSendMessage(token: string, payload: object): Promise<any> {
  const ghl = createGhlClient(token);
  const res = await ghl.post('/conversations/messages', payload);
  return res.data;
}
