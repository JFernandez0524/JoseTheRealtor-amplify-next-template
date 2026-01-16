/**
 * USER ACCOUNT DATA ACCESS LAYER
 * 
 * This file provides a centralized interface for all UserAccount database operations.
 * It abstracts away the complexity of working with Amplify's cookiesClient and provides
 * clean, reusable functions for common account operations.
 * 
 * USAGE:
 * - Import functions from this file instead of using cookiesClient.models.UserAccount directly
 * - All functions handle errors gracefully and return null/false on failure
 * - Functions are async and should be awaited
 * 
 * EXAMPLES:
 * ```typescript
 * import { getUserAccount, addCredits } from '@/app/utils/aws/data/userAccount.server';
 * 
 * const account = await getUserAccount(userId);
 * await addCredits(userId, 100);
 * ```
 * 
 * RELATED FILES:
 * - lead.server.ts - Lead data access layer
 * - subscriptionManager.ts - Subscription and billing operations
 */

import { cookiesClient } from '../auth/amplifyServerUtils.server';
import { type Schema } from '../../../../amplify/data/resource';

export type UserAccount = Schema['UserAccount']['type'];

/**
 * Get user account by owner (user ID)
 * 
 * @param ownerId - The Cognito user ID (sub)
 * @returns UserAccount object or null if not found
 * 
 * @example
 * const account = await getUserAccount('user-123');
 * if (account) {
 *   console.log(`User has ${account.credits} credits`);
 * }
 */
export async function getUserAccount(ownerId: string): Promise<UserAccount | null> {
  try {
    const { data: accounts, errors } = await cookiesClient.models.UserAccount.list({
      filter: { owner: { eq: ownerId } },
    });

    if (errors || !accounts || accounts.length === 0) {
      return null;
    }

    return accounts[0];
  } catch (error: any) {
    console.error('❌ getUserAccount error:', error.message);
    return null;
  }
}

/**
 * Update user account
 * 
 * @param accountId - The UserAccount record ID (not the owner/user ID)
 * @param updates - Partial UserAccount object with fields to update
 * @returns Updated UserAccount or null on failure
 * 
 * @example
 * await updateUserAccount(account.id, {
 *   credits: 500,
 *   ghlIntegrationType: 'OAUTH'
 * });
 */
export async function updateUserAccount(
  accountId: string,
  updates: Partial<UserAccount>
): Promise<UserAccount | null> {
  try {
    const { data: account, errors } = await cookiesClient.models.UserAccount.update({
      id: accountId,
      ...updates,
    });

    if (errors) {
      console.error('❌ updateUserAccount errors:', errors);
      return null;
    }

    return account;
  } catch (error: any) {
    console.error('❌ updateUserAccount error:', error.message);
    return null;
  }
}

/**
 * Add credits to user account
 * 
 * Safely adds credits to a user's account balance. Used for credit purchases
 * and promotional credit grants.
 * 
 * @param ownerId - The Cognito user ID
 * @param credits - Number of credits to add (must be positive)
 * @returns true if successful, false otherwise
 * 
 * @example
 * // User purchased 100 credits
 * await addCredits(userId, 100);
 */
export async function addCredits(ownerId: string, credits: number): Promise<boolean> {
  try {
    const account = await getUserAccount(ownerId);
    if (!account) return false;

    await updateUserAccount(account.id, {
      credits: (account.credits || 0) + credits,
    });

    return true;
  } catch (error: any) {
    console.error('❌ addCredits error:', error.message);
    return false;
  }
}

/**
 * Deduct credits from user account
 * 
 * Safely deducts credits and tracks usage. Used for skip tracing and other
 * credit-consuming operations. Credits cannot go below 0.
 * 
 * @param ownerId - The Cognito user ID
 * @param credits - Number of credits to deduct
 * @returns true if successful, false otherwise
 * 
 * @example
 * // User skip traced 5 leads
 * await deductCredits(userId, 5);
 */
export async function deductCredits(ownerId: string, credits: number): Promise<boolean> {
  try {
    const account = await getUserAccount(ownerId);
    if (!account) return false;

    const newCredits = Math.max(0, (account.credits || 0) - credits);
    await updateUserAccount(account.id, {
      credits: newCredits,
      totalSkipsPerformed: (account.totalSkipsPerformed || 0) + credits,
    });

    return true;
  } catch (error: any) {
    console.error('❌ deductCredits error:', error.message);
    return false;
  }
}

/**
 * Check if user has sufficient credits
 * 
 * @param ownerId - The Cognito user ID
 * @param required - Number of credits required
 * @returns true if user has enough credits, false otherwise
 * 
 * @example
 * if (await hasCredits(userId, 10)) {
 *   // Proceed with skip trace
 * } else {
 *   // Show "insufficient credits" error
 * }
 */
export async function hasCredits(ownerId: string, required: number): Promise<boolean> {
  const account = await getUserAccount(ownerId);
  return account ? (account.credits || 0) >= required : false;
}

/**
 * Update GHL rate limits
 * 
 * Tracks API calls to GoHighLevel to prevent hitting rate limits (100/hour, 1000/day).
 * Automatically resets counters after time windows expire.
 * 
 * @param ownerId - The Cognito user ID
 * @param increment - Number of API calls to add (default: 1)
 * 
 * @example
 * // After syncing a lead to GHL
 * await updateGhlRateLimits(userId);
 */
export async function updateGhlRateLimits(
  ownerId: string,
  increment: number = 1
): Promise<void> {
  try {
    const account = await getUserAccount(ownerId);
    if (!account) return;

    const now = Date.now();
    const lastHourReset = account.lastHourReset || 0;
    const lastDayReset = account.lastDayReset || 0;

    const hoursSinceReset = (now - lastHourReset) / (1000 * 60 * 60);
    const daysSinceReset = (now - lastDayReset) / (1000 * 60 * 60 * 24);

    const hourlyCount = hoursSinceReset >= 1 ? increment : (account.hourlyMessageCount || 0) + increment;
    const dailyCount = daysSinceReset >= 1 ? increment : (account.dailyMessageCount || 0) + increment;

    await updateUserAccount(account.id, {
      hourlyMessageCount: hourlyCount,
      dailyMessageCount: dailyCount,
      lastHourReset: hoursSinceReset >= 1 ? now : lastHourReset,
      lastDayReset: daysSinceReset >= 1 ? now : lastDayReset,
    });
  } catch (error: any) {
    console.error('❌ updateGhlRateLimits error:', error.message);
  }
}
