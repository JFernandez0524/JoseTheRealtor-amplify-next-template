/**
 * SUBSCRIPTION MANAGEMENT UTILITIES
 *
 * Uses AWS SDK directly so these functions work in Stripe webhook context
 * (no Cognito session cookies available in server-to-server requests).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

const USER_ACCOUNT_TABLE = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME!;
const USER_POOL_ID = process.env.AMPLIFY_AUTH_USERPOOL_ID || 'us-east-1_NR5bJQGrO';

// Amplify stores owner as "sub::identityId" — use begins_with to match on sub alone
async function getUserAccounts(userId: string) {
  const { Items } = await docClient.send(new ScanCommand({
    TableName: USER_ACCOUNT_TABLE,
    FilterExpression: 'begins_with(#owner, :userId)',
    ExpressionAttributeNames: { '#owner': 'owner' },
    ExpressionAttributeValues: { ':userId': userId },
  }));
  return Items || [];
}

export async function addCreditsToUser(userId: string, credits: number) {
  const accounts = await getUserAccounts(userId);
  if (accounts.length === 0) throw new Error(`No account found for user ${userId}`);

  // Update all records (user may have duplicates from prior race condition)
  await Promise.all(accounts.map((account) =>
    docClient.send(new UpdateCommand({
      TableName: USER_ACCOUNT_TABLE,
      Key: { id: account.id },
      UpdateExpression: 'SET credits = :credits',
      ExpressionAttributeValues: {
        ':credits': (account.credits || 0) + credits,
      },
    }))
  ));

  console.log(`✅ Added ${credits} credits to ${accounts.length} account record(s) for user ${userId}`);
}

export async function updateUserAccountForPlan(userId: string, plan: string) {
  const accounts = await getUserAccounts(userId);
  if (accounts.length === 0) throw new Error(`No account found for user ${userId}`);

  await Promise.all(accounts.map((account) =>
    docClient.send(new UpdateCommand({
      TableName: USER_ACCOUNT_TABLE,
      Key: { id: account.id },
      UpdateExpression: 'SET ghlIntegrationType = :type',
      ExpressionAttributeValues: { ':type': 'OAUTH' },
    }))
  ));

  console.log(`✅ Updated account settings for ${plan} - user ${userId}`);
}

export async function grantSubscriptionAccess(userId: string, plan: string) {
  const groupToAdd = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cognitoClient.send(new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: groupToAdd,
    UserPoolId: USER_POOL_ID,
  }));

  console.log(`✅ Granted ${groupToAdd} access for user ${userId}`);
}

export async function revokeSubscriptionAccess(userId: string, plan: string) {
  const groupToRemove = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
    Username: userId,
    GroupName: groupToRemove,
    UserPoolId: USER_POOL_ID,
  }));

  console.log(`✅ Revoked ${groupToRemove} access for user ${userId}`);
}
