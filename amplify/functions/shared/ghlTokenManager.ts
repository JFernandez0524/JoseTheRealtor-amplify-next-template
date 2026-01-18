/**
 * GHL TOKEN MANAGER - Lambda Version
 * 
 * This is a thin wrapper that uses DynamoDB client for Lambda context.
 * The actual logic matches app/utils/aws/data/ghlIntegration.server.ts
 * but uses DynamoDB instead of Amplify client for Lambda performance.
 * 
 * NOTE: Keep this in sync with app/utils/aws/data/ghlIntegration.server.ts
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
 * Lambda-optimized version using DynamoDB client
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
