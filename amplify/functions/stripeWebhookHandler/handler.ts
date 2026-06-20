import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

const USER_ACCOUNT_TABLE = process.env.AMPLIFY_DATA_UserAccount_TABLE_NAME!;
const USER_POOL_ID = process.env.AMPLIFY_AUTH_USERPOOL_ID!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function verifyStripeSignature(payload: string, header: string, secret: string): any {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const v1 = parts['v1'];

  if (!timestamp || !v1) throw new Error('Malformed stripe-signature header');

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    throw new Error('Stripe webhook timestamp outside tolerance window');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  if (
    v1.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  ) {
    throw new Error('Stripe webhook signature mismatch');
  }

  return JSON.parse(payload);
}

async function getUserAccounts(userId: string) {
  const { Items } = await docClient.send(new ScanCommand({
    TableName: USER_ACCOUNT_TABLE,
    FilterExpression: 'begins_with(#owner, :userId)',
    ExpressionAttributeNames: { '#owner': 'owner' },
    ExpressionAttributeValues: { ':userId': userId },
  }));
  return Items || [];
}

async function addCreditsToUser(userId: string, credits: number) {
  const accounts = await getUserAccounts(userId);
  if (accounts.length === 0) throw new Error(`No account found for user ${userId}`);

  await Promise.all(accounts.map((account) =>
    docClient.send(new UpdateCommand({
      TableName: USER_ACCOUNT_TABLE,
      Key: { id: account.id },
      UpdateExpression: 'SET credits = :credits',
      ExpressionAttributeValues: { ':credits': (account.credits || 0) + credits },
    }))
  ));

  console.log(`✅ Added ${credits} credits to ${accounts.length} record(s) for user ${userId}`);
}

async function updateUserAccountForPlan(userId: string, plan: string) {
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

  console.log(`✅ Updated account for ${plan} - user ${userId}`);
}

async function grantSubscriptionAccess(userId: string, plan: string) {
  const groupToAdd = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cognitoClient.send(new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: groupToAdd,
    UserPoolId: USER_POOL_ID,
  }));

  try {
    await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
      Username: userId,
      GroupName: 'FREE',
      UserPoolId: USER_POOL_ID,
    }));
  } catch {
    // User may not have been in FREE
  }

  console.log(`✅ Granted ${groupToAdd} access for user ${userId}`);
}

async function revokeSubscriptionAccess(userId: string, plan: string) {
  const groupToRemove = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
    Username: userId,
    GroupName: groupToRemove,
    UserPoolId: USER_POOL_ID,
  }));

  await cognitoClient.send(new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: 'FREE',
    UserPoolId: USER_POOL_ID,
  }));

  console.log(`✅ Revoked ${groupToRemove} access, returned user ${userId} to FREE`);
}

async function handleCheckoutCompleted(session: any) {
  const { metadata } = session;
  const { userId, plan, credits, type } = metadata;

  if (type === 'credits') {
    await addCreditsToUser(userId, parseInt(credits));
  } else if (plan === 'sync-plan' || plan === 'ai-outreach') {
    await updateUserAccountForPlan(userId, plan);
    await grantSubscriptionAccess(userId, plan);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const { status, metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  if (status === 'past_due' || status === 'unpaid') {
    await revokeSubscriptionAccess(userId, plan);
  } else if (status === 'active') {
    await grantSubscriptionAccess(userId, plan);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  const { metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  await revokeSubscriptionAccess(userId, plan);
}

export const handler = async (event: any) => {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const signature = event.headers?.['stripe-signature'];

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing stripe-signature header or STRIPE_WEBHOOK_SECRET');
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing webhook signature or secret' }) };
  }

  let stripeEvent: any;
  try {
    stripeEvent = verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(stripeEvent.data.object);
        break;
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Webhook failed' }) };
  }
};
