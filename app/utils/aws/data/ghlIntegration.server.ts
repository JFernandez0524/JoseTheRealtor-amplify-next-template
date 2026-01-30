import { cookiesClient } from '../auth/amplifyServerUtils.server';
import axios from 'axios';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;

/**
 * GHL OAUTH TOKEN MANAGEMENT - Server Utility
 * 
 * Centralized OAuth token management for GoHighLevel integration.
 * Used by API routes and server-side operations.
 * 
 * ARCHITECTURE:
 * - Uses Amplify Data client (cookiesClient) for database operations
 * - Automatically refreshes expired tokens
 * - Handles all OAuth lifecycle operations
 * 
 * RELATED FILES:
 * - amplify/functions/shared/ghlTokenManager.ts - Lambda version (uses DynamoDB)
 * - app/api/v1/oauth/callback/route.ts - OAuth callback handler
 * - app/api/v1/oauth/refresh/route.ts - Manual token refresh endpoint
 * - app/api/v1/send-test-to-contact/route.ts - Uses getValidGhlToken()
 * 
 * NOTE: Lambda functions use their own version with DynamoDB client for performance.
 * Keep logic in sync between this file and amplify/functions/shared/ghlTokenManager.ts
 */

/**
 * Gets a valid GHL access token for a user, refreshing if expired
 * 
 * This is the primary function to use before any GHL API call.
 * Automatically handles token expiration and refresh.
 * 
 * @param userId - The Cognito user ID (sub)
 * @returns Valid access token or null if user not connected/refresh failed
 * 
 * @example
 * const token = await getValidGhlToken(user.userId);
 * if (!token) {
 *   return NextResponse.json({ error: 'GHL not connected' }, { status: 404 });
 * }
 * 
 * // Use token for GHL API calls
 * await axios.get('https://services.leadconnectorhq.com/contacts', {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 */
export async function getValidGhlToken(userId: string): Promise<string | null> {
  try {
    // Get user's GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId }, isActive: { eq: true } }
    });

    if (!integrations || integrations.length === 0) {
      console.log(`❌ No GHL integration found for user ${userId}`);
      return null;
    }

    const integration = integrations[0];
    
    if (!integration.refreshToken) {
      console.log(`❌ No refresh token for user ${userId}`);
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(integration.expiresAt);

    // Token still valid
    if (expiresAt > now) {
      console.log(`✅ Token valid for user ${userId}`);
      return integration.accessToken;
    }

    // Token expired - refresh it
    console.log(`🔄 Token expired for user ${userId}, refreshing...`);
    
    const newToken = await refreshGhlToken(integration.id, integration.refreshToken);
    return newToken;

  } catch (error: any) {
    console.error(`❌ Failed to get token for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Refreshes a GHL OAuth token
 * 
 * Called automatically by getValidGhlToken() when token is expired.
 * Can also be called manually via /api/v1/oauth/refresh endpoint.
 * 
 * @param integrationId - The GhlIntegration record ID
 * @param refreshToken - The refresh token
 * @returns New access token or null if refresh failed
 * 
 * @example
 * const newToken = await refreshGhlToken(integration.id, integration.refreshToken);
 * if (!newToken) {
 *   // Token refresh failed - user needs to reconnect
 * }
 */
export async function refreshGhlToken(integrationId: string, refreshToken: string): Promise<string | null> {
  try {
    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      console.error('❌ GHL_CLIENT_ID or GHL_CLIENT_SECRET not set');
      return null;
    }

    // Check if token was already refreshed by another process
    const { data: current } = await cookiesClient.models.GhlIntegration.get({ id: integrationId });
    if (current && current.refreshToken !== refreshToken) {
      console.log(`🔄 Token already refreshed by another process, checking validity...`);
      const expiresAt = new Date(current.expiresAt);
      if (expiresAt > new Date()) {
        console.log(`✅ Using already-refreshed token`);
        return current.accessToken;
      }
    }

    // Call GHL OAuth token endpoint
    const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
      client_id: GHL_CLIENT_ID,
      client_secret: GHL_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;
    const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Update token in database
    await cookiesClient.models.GhlIntegration.update({
      id: integrationId,
      accessToken: access_token,
      refreshToken: new_refresh_token,
      expiresAt: newExpiresAt,
    });

    console.log(`✅ Token refreshed for integration ${integrationId}`);
    return access_token;

  } catch (error: any) {
    console.error(`❌ Failed to refresh token:`, error.message);
    
    // If refresh failed, check if another process succeeded
    try {
      const { data: retry } = await cookiesClient.models.GhlIntegration.get({ id: integrationId });
      if (retry && retry.refreshToken !== refreshToken) {
        const expiresAt = new Date(retry.expiresAt);
        if (expiresAt > new Date()) {
          console.log(`✅ Another process refreshed token successfully`);
          return retry.accessToken;
        }
      }
    } catch (retryError) {
      // Ignore retry errors
    }
    
    return null;
  }
}

/**
 * Creates a new GHL integration from OAuth callback
 * 
 * Called by /api/v1/oauth/callback after successful OAuth flow.
 * Stores access token, refresh token, and metadata.
 * 
 * IMPORTANT: Automatically deactivates any existing integrations for this user
 * to prevent duplicate/stale tokens from being used by agents.
 * 
 * @param userId - The Cognito user ID
 * @param tokenData - OAuth token response data from GHL
 * 
 * @example
 * await createGhlIntegration(userId, {
 *   access_token: 'token...',
 *   refresh_token: 'refresh...',
 *   expires_in: 86400,
 *   locationId: 'loc_123'
 * });
 */
export async function createGhlIntegration(userId: string, tokenData: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  locationId: string;
}) {
  try {
    const { access_token, refresh_token, expires_in, locationId } = tokenData;

    // 1. Delete any existing integrations for this user
    console.log(`🔄 Checking for existing integrations for user ${userId}...`);
    const { data: existingIntegrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId } }
    });

    if (existingIntegrations && existingIntegrations.length > 0) {
      console.log(`⚠️ Found ${existingIntegrations.length} existing integration(s), deleting...`);
      
      for (const integration of existingIntegrations) {
        await cookiesClient.models.GhlIntegration.delete({
          id: integration.id
        });
        console.log(`✅ Deleted integration ${integration.id}`);
      }
    }

    // 2. Create new active integration
    await cookiesClient.models.GhlIntegration.create({
      userId: userId,
      locationId: locationId || 'default',
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + (expires_in * 1000)).toISOString(),
      scope: 'contacts.readonly contacts.write locations/tags.write conversations/message.readonly conversations/message.write',
      isActive: true,
      dailyMessageCount: 0,
      hourlyMessageCount: 0,
    });

    console.log('✅ GHL integration created for user:', userId);
  } catch (error: any) {
    console.error('❌ Failed to create GHL integration:', error.message);
    throw error;
  }
}

/**
 * Checks if user has an active GHL integration
 * 
 * Quick check to see if user has connected their GHL account.
 * Used for feature gating and UI state.
 * 
 * @param userId - The Cognito user ID
 * @returns true if user has active integration
 * 
 * @example
 * const hasGhl = await hasGhlIntegration(user.userId);
 * if (!hasGhl) {
 *   return <ConnectGHLButton />;
 * }
 */
export async function hasGhlIntegration(userId: string): Promise<boolean> {
  try {
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId }, isActive: { eq: true } }
    });

    return integrations && integrations.length > 0;
  } catch (error) {
    console.error('Failed to check GHL integration:', error);
    return false;
  }
}

/**
 * Gets user's GHL integration details
 * 
 * Returns full integration record including tokens and metadata.
 * Use getValidGhlToken() if you only need the access token.
 * 
 * @param userId - The Cognito user ID
 * @returns Integration record or null if not found
 * 
 * @example
 * const integration = await getGhlIntegration(user.userId);
 * if (integration) {
 *   console.log('Connected to location:', integration.locationId);
 * }
 */
export async function getGhlIntegration(userId: string) {
  try {
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: userId }, isActive: { eq: true } }
    });

    return integrations && integrations.length > 0 ? integrations[0] : null;
  } catch (error) {
    console.error('Failed to get GHL integration:', error);
    return null;
  }
}
