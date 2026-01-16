/**
 * SUBSCRIPTION MANAGEMENT UTILITIES
 * 
 * This file handles all subscription-related operations including access control,
 * Cognito group management, and account updates for billing events.
 * 
 * USAGE:
 * - Called by Stripe webhook handlers to manage user access
 * - Handles subscription lifecycle: activation, payment failures, cancellations
 * - Manages Cognito group membership (PRO, AI_PLAN) for authorization
 * 
 * FLOW:
 * 1. Stripe sends webhook (checkout.completed, subscription.updated, etc.)
 * 2. Webhook handler calls functions from this file
 * 3. Functions update Cognito groups and UserAccount records
 * 4. Authorization checks in Lambda functions use group membership
 * 
 * EXAMPLES:
 * ```typescript
 * import { grantSubscriptionAccess, revokeSubscriptionAccess } from '@/app/utils/billing/subscriptionManager';
 * 
 * // When payment succeeds
 * await grantSubscriptionAccess(userId, 'ai-outreach');
 * 
 * // When payment fails
 * await revokeSubscriptionAccess(userId, 'ai-outreach');
 * ```
 * 
 * RELATED FILES:
 * - app/api/v1/billing/webhook/route.ts - Stripe webhook handler
 * - amplify/functions/manualGhlSync/handler.ts - Uses group authorization
 */

import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

/**
 * Removes user from Cognito group when subscription ends or payment fails
 * 
 * This immediately revokes access to paid features. The user will be blocked
 * from GHL sync, skip tracing (if not FREE tier), and other premium features.
 * 
 * @param userId - The Cognito user ID (sub)
 * @param plan - The subscription plan ('sync-plan' or 'ai-outreach')
 * 
 * @example
 * // Payment failed - remove access immediately
 * await revokeSubscriptionAccess(userId, 'ai-outreach');
 */
export async function revokeSubscriptionAccess(userId: string, plan: string) {
  const groupToRemove = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cookiesClient.mutations.removeUserFromGroup({
    userId,
    groupName: groupToRemove,
  });

  console.log(`✅ Revoked ${groupToRemove} access for user ${userId}`);
}

/**
 * Adds user to Cognito group when subscription is activated or payment succeeds
 * 
 * Grants access to paid features by adding user to PRO or AI_PLAN group.
 * Lambda functions check group membership for authorization.
 * 
 * @param userId - The Cognito user ID (sub)
 * @param plan - The subscription plan ('sync-plan' or 'ai-outreach')
 * 
 * @example
 * // Subscription activated - grant access
 * await grantSubscriptionAccess(userId, 'sync-plan');
 */
export async function grantSubscriptionAccess(userId: string, plan: string) {
  const groupToAdd = plan === 'ai-outreach' ? 'AI_PLAN' : 'PRO';

  await cookiesClient.mutations.addUserToGroup({
    userId,
    groupName: groupToAdd,
  });

  console.log(`✅ Granted ${groupToAdd} access for user ${userId}`);
}

/**
 * Updates user account settings for subscription plan
 * 
 * Sets account-level configuration like GHL integration type.
 * Called after successful subscription purchase.
 * 
 * @param userId - The Cognito user ID (sub)
 * @param plan - The subscription plan ('sync-plan' or 'ai-outreach')
 * 
 * @example
 * await updateUserAccountForPlan(userId, 'sync-plan');
 */
export async function updateUserAccountForPlan(userId: string, plan: string) {
  const { data: accounts } = await cookiesClient.models.UserAccount.list({
    filter: { owner: { eq: userId } }
  });

  const userAccount = accounts?.[0];
  if (!userAccount) {
    throw new Error(`No account found for user ${userId}`);
  }

  await cookiesClient.models.UserAccount.update({
    id: userAccount.id,
    ghlIntegrationType: 'OAUTH',
  });

  console.log(`✅ Updated account settings for ${plan} - user ${userId}`);
}

/**
 * Adds credits to user account
 * 
 * Used for one-time credit purchases (not subscriptions).
 * Credits are used for skip tracing at $0.10 per lead.
 * 
 * @param userId - The Cognito user ID (sub)
 * @param credits - Number of credits to add
 * 
 * @example
 * // User purchased 100 credits for $10
 * await addCreditsToUser(userId, 100);
 */
export async function addCreditsToUser(userId: string, credits: number) {
  const { data: accounts } = await cookiesClient.models.UserAccount.list({
    filter: { owner: { eq: userId } }
  });

  const userAccount = accounts?.[0];
  if (!userAccount) {
    throw new Error(`No account found for user ${userId}`);
  }

  await cookiesClient.models.UserAccount.update({
    id: userAccount.id,
    credits: (userAccount.credits || 0) + credits,
  });

  console.log(`✅ Added ${credits} credits to user ${userId}`);
}
