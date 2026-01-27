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

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

type GhlIntegration = {
  id: string;
  userId: string;
  locationId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  isActive: boolean;
};

/**
 * Gets a valid GHL access token for a user, refreshing if expired
 * Lambda-optimized version using DynamoDB client
 */
export async function getValidGhlToken(userId: string): Promise<{ token: string; locationId: string } | null> {
  console.log(`🔑 [TOKEN_MANAGER] Getting token for user: ${userId}`);
  console.log(`🔑 [TOKEN_MANAGER] Table name: ${GHL_INTEGRATION_TABLE}`);
  console.log(`🔑 [TOKEN_MANAGER] Region: ${process.env.AWS_REGION}`);
  
  try {
    console.log(`🔍 [TOKEN_MANAGER] Scanning DynamoDB for active integration...`);
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId AND isActive = :active',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': true
      }
    }));

    if (!Items || Items.length === 0) {
      console.log(`❌ [TOKEN_MANAGER] No GHL integration found for user ${userId}`);
      return null;
    }

    console.log(`✅ [TOKEN_MANAGER] Found integration for user ${userId}`);
    const integration = Items[0] as GhlIntegration;
    const now = new Date();
    const expiresAt = new Date(integration.expiresAt);
    
    console.log(`🔍 [TOKEN_MANAGER] Token expires at: ${expiresAt.toISOString()}`);
    console.log(`🔍 [TOKEN_MANAGER] Current time: ${now.toISOString()}`);

    // Token still valid
    if (expiresAt > now) {
      console.log(`✅ [TOKEN_MANAGER] Token valid for user ${userId}`);
      return { token: integration.accessToken, locationId: integration.locationId };
    }

    // Token expired - refresh it
    console.log(`🔄 [TOKEN_MANAGER] Token expired for user ${userId}, refreshing...`);
    
    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      console.error('❌ [TOKEN_MANAGER] GHL_CLIENT_ID or GHL_CLIENT_SECRET not set');
      return null;
    }

    try {
      console.log(`🔄 [TOKEN_MANAGER] Calling GHL token refresh endpoint...`);
      const response = await axios.post(
        'https://services.leadconnectorhq.com/oauth/token',
        new URLSearchParams({
          client_id: GHL_CLIENT_ID,
          client_secret: GHL_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: integration.refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      
      console.log(`✅ [TOKEN_MANAGER] Token refreshed, new expiry: ${newExpiresAt}`);

      // Update token in database with conditional check to prevent race conditions
      console.log(`💾 [TOKEN_MANAGER] Updating token in DynamoDB...`);
      await docClient.send(new UpdateCommand({
        TableName: GHL_INTEGRATION_TABLE,
        Key: { id: integration.id },
        UpdateExpression: 'SET accessToken = :token, refreshToken = :refresh, expiresAt = :expires, updatedAt = :updated',
        ConditionExpression: 'refreshToken = :oldRefresh',
        ExpressionAttributeValues: {
          ':token': access_token,
          ':refresh': refresh_token,
          ':expires': newExpiresAt,
          ':updated': new Date().toISOString(),
          ':oldRefresh': integration.refreshToken,
        }
      }));

      console.log(`✅ [TOKEN_MANAGER] Token refreshed and saved for user ${userId}`);
      return { token: access_token, locationId: integration.locationId };
    } catch (refreshError: any) {
      // Log the actual GHL error response
      if (refreshError.response?.data) {
        console.error(`❌ [TOKEN_MANAGER] GHL refresh error:`, JSON.stringify(refreshError.response.data));
      }
      
      // If refresh token is invalid (400), mark integration as inactive
      if (refreshError.response?.status === 400) {
        console.error(`❌ [TOKEN_MANAGER] Refresh token invalid - marking integration as inactive`);
        await docClient.send(new UpdateCommand({
          TableName: GHL_INTEGRATION_TABLE,
          Key: { id: integration.id },
          UpdateExpression: 'SET isActive = :inactive, updatedAt = :updated',
          ExpressionAttributeValues: {
            ':inactive': false,
            ':updated': new Date().toISOString()
          }
        }));
        throw new Error('GHL_REFRESH_TOKEN_EXPIRED: Please reconnect your GoHighLevel account');
      }
      
      // If conditional update failed, another process already refreshed - retry once
      if (refreshError.name === 'ConditionalCheckFailedException') {
        console.log(`🔄 [TOKEN_MANAGER] Token was refreshed by another process, re-fetching...`);
        const { Items: retryItems } = await docClient.send(new ScanCommand({
          TableName: GHL_INTEGRATION_TABLE,
          FilterExpression: 'userId = :userId AND isActive = :active',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':active': true
          }
        }));
        
        if (retryItems && retryItems.length > 0) {
          const updated = retryItems[0] as GhlIntegration;
          const retryExpires = new Date(updated.expiresAt);
          if (retryExpires > new Date()) {
            console.log(`✅ [TOKEN_MANAGER] Using refreshed token from other process`);
            return { token: updated.accessToken, locationId: updated.locationId };
          }
        }
      }
      throw refreshError;
    }

  } catch (error: any) {
    console.error(`❌ [TOKEN_MANAGER] Failed to get/refresh token for user ${userId}:`, error.message);
    console.error(`❌ [TOKEN_MANAGER] Stack:`, error.stack);
    return null;
  }
}
