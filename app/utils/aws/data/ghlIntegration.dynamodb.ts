/**
 * GHL Integration - DynamoDB Direct Access
 * 
 * For use in API routes (webhooks) where Amplify client authentication is not available.
 * Uses raw DynamoDB client which works with Lambda's IAM role.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

interface GhlIntegration {
  id: string;
  userId: string;
  locationId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  isActive: boolean;
}

/**
 * Get active GHL integration by userId
 * For use in webhooks where no authenticated user context exists
 */
export async function getGhlIntegrationByUserId(userId: string): Promise<GhlIntegration | null> {
  console.log('🔍 [DYNAMODB_UTIL] Table name:', GHL_INTEGRATION_TABLE);
  console.log('🔍 [DYNAMODB_UTIL] Region:', process.env.AWS_REGION);
  console.log('🔍 [DYNAMODB_UTIL] Querying for userId:', userId);
  
  if (!GHL_INTEGRATION_TABLE) {
    console.error('❌ [DYNAMODB_UTIL] AMPLIFY_DATA_GhlIntegration_TABLE_NAME not set');
    return null;
  }

  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId AND isActive = :active',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': true
      }
    }));

    console.log('🔍 [DYNAMODB_UTIL] Query returned', Items?.length || 0, 'items');

    if (Items && Items.length > 0) {
      console.log('✅ [DYNAMODB_UTIL] Found integration');
      return Items[0] as GhlIntegration;
    }

    console.log('⚠️ [DYNAMODB_UTIL] No integration found');
    return null;
  } catch (error: any) {
    console.error('❌ [DYNAMODB_UTIL] Query failed:', error);
    console.error('❌ [DYNAMODB_UTIL] Error name:', error.name);
    console.error('❌ [DYNAMODB_UTIL] Error message:', error.message);
    console.error('❌ [DYNAMODB_UTIL] Error code:', error.code);
    return null;
  }
}

/**
 * Get active GHL integration by locationId
 * For use in webhooks where only locationId is available
 */
export async function getGhlIntegrationByLocationId(locationId: string): Promise<GhlIntegration | null> {
  if (!GHL_INTEGRATION_TABLE) {
    console.error('❌ AMPLIFY_DATA_GhlIntegration_TABLE_NAME not set');
    return null;
  }

  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'locationId = :locationId AND isActive = :active',
      ExpressionAttributeValues: {
        ':locationId': locationId,
        ':active': true
      }
    }));

    if (Items && Items.length > 0) {
      return Items[0] as GhlIntegration;
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to query GhlIntegration:', error);
    return null;
  }
}
