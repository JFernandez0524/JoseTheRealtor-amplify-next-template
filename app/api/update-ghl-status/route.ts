/**
 * POST /api/update-ghl-status
 *
 * Admin utility to manually override a lead's GHL sync status in DynamoDB.
 * Bypasses normal auth — protected by a hardcoded admin key instead.
 *
 * AUTH: adminKey must equal "ghl-admin-2026" (passed in request body)
 * REQUEST BODY: { leadId, ghlContactId?, status, adminKey }
 * RESPONSE: { success: true }
 *
 * NOTE: Intended for one-off operational fixes, not regular use.
 * Consider migrating to ADMINS group auth if usage grows.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;

export async function POST(request: Request) {
  try {
    const { leadId, ghlContactId, status, adminKey } = await request.json();
    
    if (adminKey !== 'ghl-admin-2026') {
      return Response.json({ 
        success: false, 
        error: 'Admin key required' 
      }, { status: 401 });
    }
    
    if (!TABLE_NAME) {
      throw new Error('Table name not configured');
    }
    
    const updateExpression = ghlContactId 
      ? 'SET #ghlSyncStatus = :status, #ghlContactId = :contactId, #ghlSyncDate = :syncDate'
      : 'SET #ghlSyncStatus = :status, #ghlSyncDate = :syncDate';
    
    const expressionAttributeNames: any = {
      '#ghlSyncStatus': 'ghlSyncStatus',
      '#ghlSyncDate': 'ghlSyncDate'
    };
    
    const expressionAttributeValues: any = {
      ':status': status,
      ':syncDate': new Date().toISOString()
    };
    
    if (ghlContactId) {
      expressionAttributeNames['#ghlContactId'] = 'ghlContactId';
      expressionAttributeValues[':contactId'] = ghlContactId;
    }
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: leadId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    
    return Response.json({ 
      success: true, 
      message: `Updated lead ${leadId} to ${status}`
    });
  } catch (error: any) {
    console.error('Update error:', error);
    return Response.json({ 
      success: false, 
      error: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
