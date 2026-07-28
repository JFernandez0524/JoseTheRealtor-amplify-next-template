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
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  MAX_RETRIES,
  getRetryDelayMs,
  isRetryableStatus,
} from './apiRetry';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

/** Per-request retry bookkeeping, carried on the axios config across interceptor passes. */
type RetryableConfig = InternalAxiosRequestConfig & { __ghlRetryCount?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates an axios instance for the GHL API with automatic retry on transient failures.
 *
 * The retry lives in a response interceptor rather than in the named helpers below because callers
 * (notably `manualGhlSync/integrations/gohighlevel.ts`) use the returned instance directly —
 * `ghl.post('/contacts/search', …)`, `ghl.put(…)`. Putting it here means every GHL call in every
 * Lambda inherits backoff from one place.
 *
 * See `apiRetry.ts` for which statuses retry and how the delay is chosen.
 */
export function createGhlClient(token: string): AxiosInstance {
  const client = axios.create({
    baseURL: GHL_BASE_URL,
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: GHL_VERSION,
    },
  });

  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status ?? null;

    // No config means the request was never dispatched — nothing to replay.
    if (!config || !isRetryableStatus(status)) {
      return Promise.reject(error);
    }

    const attempt = config.__ghlRetryCount ?? 0;
    if (attempt >= MAX_RETRIES) {
      console.error(
        `❌ [GHL] ${config.method?.toUpperCase()} ${config.url} still failing with ${status} ` +
          `after ${MAX_RETRIES} retries — giving up.`
      );
      return Promise.reject(error);
    }

    const retryAfter =
      (error.response?.headers?.['retry-after'] as string | undefined) ?? null;
    const delay = getRetryDelayMs(attempt, retryAfter);

    console.warn(
      `⏳ [GHL] ${status} on ${config.method?.toUpperCase()} ${config.url} — ` +
        `retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`
    );

    config.__ghlRetryCount = attempt + 1;
    await sleep(delay);
    return client.request(config);
  });

  return client;
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
