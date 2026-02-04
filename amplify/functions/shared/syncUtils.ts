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
  const updateExpression = status === 'SUCCESS' 
    ? 'SET ghlSyncStatus = :status, ghlContactId = :contactId, ghlSyncDate = :syncDate'
    : 'SET ghlSyncStatus = :status';
    
  const expressionValues: any = { ':status': status };
  
  if (status === 'SUCCESS' && contactId) {
    expressionValues[':contactId'] = contactId;
    expressionValues[':syncDate'] = new Date().toISOString();
  }

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: leadId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues
  }));
}

export function validateLeadForSync(lead: any): { isValid: boolean; reason?: string } {
  // Check skip trace status
  if (lead.skipTraceStatus?.toUpperCase() !== 'COMPLETED') {
    return { isValid: false, reason: `Skip trace not completed: ${lead.skipTraceStatus}` };
  }

  // Check contact information
  const phones = lead.phones || [];
  const emails = lead.emails || [];
  const hasContact = phones.length > 0 || emails.length > 0;
  
  if (!hasContact) {
    return { isValid: false, reason: 'No phone numbers or email addresses found' };
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
