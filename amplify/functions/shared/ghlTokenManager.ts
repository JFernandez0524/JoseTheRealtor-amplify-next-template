/**
 * GHL TOKEN MANAGER
 * 
 * Manages GoHighLevel OAuth tokens with automatic refresh functionality.
 * Ensures users stay connected to GHL without manual reconnection.
 * 
 * PROBLEM SOLVED:
 * - GHL access tokens expire after 24 hours
 * - Without refresh, users must reconnect manually
 * - This module automatically refreshes tokens before they expire
 * 
 * USAGE:
 * - Called by GHL sync functions before making API calls
 * - Checks token expiration and refreshes if needed
 * - Updates database with new tokens
 * 
 * FLOW:
 * 1. Function needs to call GHL API
 * 2. Calls getValidGhlToken(userId)
 * 3. Module checks if token is expired
 * 4. If expired, uses refresh token to get new access token
 * 5. Saves new tokens to database
 * 6. Returns valid access token
 * 
 * EXAMPLES:
 * ```typescript
 * import { getValidGhlToken } from '@/amplify/functions/shared/ghlTokenManager';
 * 
 * const token = await getValidGhlToken(userId);
 * if (!token) {
 *   throw new Error('GHL not connected');
 * }
 * 
 * // Use token for API calls
 * const ghl = axios.create({
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 * ```
 * 
 * RELATED FILES:
 * - amplify/functions/manualGhlSync/handler.ts - Uses this for sync operations
 * - app/api/v1/oauth/callback/route.ts - Initial OAuth connection
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

type GhlIntegration = {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  isActive: boolean;
};

/**
 * Gets a valid GHL access token for a user, refreshing if expired
 * 
 * This is the main function to use before any GHL API call. It handles
 * token expiration automatically so you don't have to check manually.
 * 
 * @param userId - The Cognito user ID (sub)
 * @returns Valid access token or null if user not connected/refresh failed
 * 
 * @example
 * const token = await getValidGhlToken(userId);
 * if (!token) {
 *   return { status: 'FAILED', message: 'GHL not connected' };
 * }
 * 
 * // Token is valid, use it for API calls
 * await axios.get('https://services.leadconnectorhq.com/contacts', {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 */
export async function getValidGhlToken(userId: string): Promise<string | null> {
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId AND isActive = :active',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': true
      }
    }));

    if (!Items || Items.length === 0) {
      console.log(`❌ No GHL integration found for user ${userId}`);
      return null;
    }

    const integration = Items[0] as GhlIntegration;
    const now = new Date();
    const expiresAt = new Date(integration.expiresAt);

    // Token still valid
    if (expiresAt > now) {
      console.log(`✅ Token valid for user ${userId}`);
      return integration.accessToken;
    }

    // Token expired - refresh it
    console.log(`🔄 Token expired for user ${userId}, refreshing...`);
    
    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      console.error('❌ GHL_CLIENT_ID or GHL_CLIENT_SECRET not set');
      return null;
    }

    const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
      client_id: GHL_CLIENT_ID,
      client_secret: GHL_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    });

    const { access_token, refresh_token, expires_in } = response.data;
    const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Update token in database
    await docClient.send(new UpdateCommand({
      TableName: GHL_INTEGRATION_TABLE,
      Key: { id: integration.id },
      UpdateExpression: 'SET accessToken = :token, refreshToken = :refresh, expiresAt = :expires, updatedAt = :updated',
      ExpressionAttributeValues: {
        ':token': access_token,
        ':refresh': refresh_token,
        ':expires': newExpiresAt,
        ':updated': new Date().toISOString(),
      }
    }));

    console.log(`✅ Token refreshed for user ${userId}`);
    return access_token;

  } catch (error: any) {
    console.error(`❌ Failed to get/refresh token for user ${userId}:`, error.message);
    return null;
  }
}
