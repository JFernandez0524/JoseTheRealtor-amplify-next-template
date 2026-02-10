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
  status: 'SUCCESS' | 'FAILED',
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
  // Check skip trace status - COMPLETED, NO_QUALITY_CONTACTS, and NO_MATCH are all valid completed statuses
  const skipTraceStatus = lead.skipTraceStatus?.toUpperCase();
  const validStatuses = ['COMPLETED', 'NO_QUALITY_CONTACTS', 'NO_MATCH'];
  
  if (!skipTraceStatus || !validStatuses.includes(skipTraceStatus)) {
    return { isValid: false, reason: `Skip trace not completed: ${lead.skipTraceStatus}` };
  }

  // Skip contact validation for NO_QUALITY_CONTACTS and NO_MATCH (direct mail leads)
  if (skipTraceStatus !== 'NO_QUALITY_CONTACTS' && skipTraceStatus !== 'NO_MATCH') {
    const phones = lead.phones || [];
    const emails = lead.emails || [];
    const hasContact = phones.length > 0 || emails.length > 0;
    
    if (!hasContact) {
      return { isValid: false, reason: 'No phone numbers or email addresses found' };
    }
  }

  // Check probate admin info (with fallback to owner info)
  if (lead.type?.toUpperCase() === 'PROBATE') {
    const hasAdminInfo = lead.adminFirstName && lead.adminLastName;
    const hasOwnerInfo = lead.ownerFirstName && lead.ownerLastName;
    
    if (!hasAdminInfo && !hasOwnerInfo) {
      return { isValid: false, reason: 'Probate lead missing both admin and owner information' };
    }
  }

  return { isValid: true };
}
