export interface GhlIntegrationRecord {
  id: string;
  locationId?: string | null;
  expiresAt: string;
  refreshToken?: string | null;
}

export interface GhlConnectionResult {
  isConnected: boolean;
  locationId: string | null;
  integrationId: string | null;
}

export interface GhlConnectionDeps {
  getUser: () => Promise<{ userId: string } | null>;
  ensureSession: () => Promise<boolean>;
  listIntegrations: (userId: string) => Promise<{
    data: GhlIntegrationRecord[] | null;
    errors?: unknown[];
  }>;
  refreshToken: () => Promise<{ ok: boolean; status: number }>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

const DEFAULT_RETRY_DELAYS_MS = [250, 600];
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const DISCONNECTED_RESULT: GhlConnectionResult = {
  isConnected: false,
  locationId: null,
  integrationId: null,
};

/**
 * Fetches active GHL integrations with short retries for transient auth/AppSync
 * errors that can occur immediately after client-side sign-in.
 */
async function listIntegrationsWithRetry(
  userId: string,
  deps: Pick<GhlConnectionDeps, 'ensureSession' | 'listIntegrations'>,
  sleep: (ms: number) => Promise<void>
): Promise<GhlIntegrationRecord[] | null> {
  for (let attempt = 0; attempt <= DEFAULT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await deps.listIntegrations(userId);
      const hasErrors = Boolean(result.errors && result.errors.length > 0);
      if (!hasErrors) {
        return result.data ?? [];
      }
      if (result.data && result.data.length > 0) {
        return result.data;
      }
    } catch {
      // Retry below on transient network or auth-session timing errors
    }

    if (attempt < DEFAULT_RETRY_DELAYS_MS.length) {
      await sleep(DEFAULT_RETRY_DELAYS_MS[attempt]);
      await deps.ensureSession();
    }
  }

  return null;
}

/**
 * Refreshes an expired GHL OAuth token with short retries.
 * Handles 401 races right after login when Next.js SSR cookies are still settling.
 */
async function refreshTokenWithRetry(
  deps: Pick<GhlConnectionDeps, 'ensureSession' | 'refreshToken'>,
  sleep: (ms: number) => Promise<void>
): Promise<boolean> {
  for (let attempt = 0; attempt <= DEFAULT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await deps.refreshToken();
      if (response.ok) {
        return true;
      }
      // Only retry on 401 (SSR cookie not yet settled) or 5xx transient server errors
      if (response.status !== 401 && response.status < 500) {
        return false;
      }
    } catch {
      // Retry below on transient network errors
    }

    if (attempt < DEFAULT_RETRY_DELAYS_MS.length) {
      await sleep(DEFAULT_RETRY_DELAYS_MS[attempt]);
      await deps.ensureSession();
    }
  }

  return false;
}

/**
 * Resolves the user's current GHL connection state, ensuring the Amplify auth
 * session is ready and auto-refreshing expired GHL tokens with retry protection.
 */
export async function resolveGhlConnection(
  deps: GhlConnectionDeps
): Promise<GhlConnectionResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date());

  const user = await deps.getUser();
  if (!user) {
    return DISCONNECTED_RESULT;
  }

  const hasSession = await deps.ensureSession();
  if (!hasSession) {
    await sleep(DEFAULT_RETRY_DELAYS_MS[0]);
    await deps.ensureSession();
  }

  const integrations = await listIntegrationsWithRetry(user.userId, deps, sleep);
  if (!integrations || integrations.length === 0) {
    return DISCONNECTED_RESULT;
  }

  const integration = integrations[0];
  const isExpired = new Date(integration.expiresAt) < now();

  if (!isExpired) {
    return {
      isConnected: true,
      locationId: integration.locationId || null,
      integrationId: integration.id,
    };
  }

  if (!integration.refreshToken) {
    return {
      isConnected: false,
      locationId: integration.locationId || null,
      integrationId: integration.id,
    };
  }

  const refreshed = await refreshTokenWithRetry(deps, sleep);
  if (!refreshed) {
    return {
      isConnected: false,
      locationId: integration.locationId || null,
      integrationId: integration.id,
    };
  }

  // Re-read the updated integration record once; if the read transiently fails,
  // trust the successful token refresh so we don't falsely show a disconnected banner.
  const updatedIntegrations = await listIntegrationsWithRetry(user.userId, deps, sleep);
  const current = updatedIntegrations?.[0] ?? integration;

  return {
    isConnected: true,
    locationId: current.locationId || null,
    integrationId: current.id,
  };
}
