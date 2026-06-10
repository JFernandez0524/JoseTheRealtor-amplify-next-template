// Shared sync utilities to eliminate code duplication
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export type SyncResult = {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ERROR' | 'NO_CHANGE';
  message: string;
  ghlContactId?: string | null;
};

export async function updateLeadSyncStatus(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  leadId: string,
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
  contactId?: string
): Promise<void> {
  console.log(`📝 Updating lead ${leadId} sync status to ${status}${contactId ? ` with contactId ${contactId}` : ''}`);
  
  const updateExpression = status === 'SUCCESS' 
    ? 'SET #ghlSyncStatus = :status, #ghlContactId = :contactId, #ghlSyncDate = :syncDate'
    : 'SET #ghlSyncStatus = :status';
    
  const expressionAttributeNames: any = {
    '#ghlSyncStatus': 'ghlSyncStatus'
  };
  
  const expressionValues: any = { ':status': status };
  
  if (status === 'SUCCESS' && contactId) {
    expressionAttributeNames['#ghlContactId'] = 'ghlContactId';
    expressionAttributeNames['#ghlSyncDate'] = 'ghlSyncDate';
    expressionValues[':contactId'] = contactId;
    expressionValues[':syncDate'] = new Date().toISOString();
  }

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: leadId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionValues
  }));
  
  console.log(`✅ Lead ${leadId} status updated to ${status}`);
}

export function validateLeadForSync(lead: any): { isValid: boolean; reason?: string } {
  const skipTraceStatus = lead.skipTraceStatus?.toUpperCase();
  const validStatuses = ['COMPLETED', 'NO_QUALITY_CONTACTS', 'NO_MATCH'];

  if (!skipTraceStatus || !validStatuses.includes(skipTraceStatus)) {
    return { isValid: false, reason: `Skip trace not completed (status: ${lead.skipTraceStatus || 'none'})` };
  }

  // COMPLETED leads with no phones/emails are still valid — they go through as direct-mail contacts
  // (same path as NO_QUALITY_CONTACTS and NO_MATCH)

  return { isValid: true };
}
