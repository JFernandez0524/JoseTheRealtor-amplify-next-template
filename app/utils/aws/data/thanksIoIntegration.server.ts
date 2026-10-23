/**
 * THANKS.IO INTEGRATION - Centralized Data Access Layer
 *
 * Provides a clean interface for reading and writing tenant-specific Thanks.io settings.
 * Ensures multi-tenant isolation so each user manages their own API key, billing,
 * and direct mail campaigns.
 *
 * USAGE:
 * - Always use these functions in server routes and actions instead of direct database calls.
 */

import { getUserAccount, updateUserAccount } from './userAccount.server';

export interface ThanksIoSettings {
  apiKey: string | null;
  accountEmail: string | null;
  partnerConfirmed: boolean;
  isConnected: boolean;
}

/**
 * Get tenant's Thanks.io integration settings.
 *
 * @param userId - Cognito user ID (sub)
 * @returns ThanksIoSettings object
 */
export async function getThanksIoSettings(userId: string): Promise<ThanksIoSettings> {
  try {
    const account = await getUserAccount(userId);
    if (!account) {
      return {
        apiKey: null,
        accountEmail: null,
        partnerConfirmed: false,
        isConnected: false,
      };
    }

    const apiKey = account.thanksIoApiKey?.trim() || null;

    return {
      apiKey,
      accountEmail: account.thanksIoAccountEmail || null,
      partnerConfirmed: !!account.thanksIoPartnerConfirmed,
      isConnected: !!apiKey,
    };
  } catch (error: any) {
    console.error('❌ [THANKS.IO DAL] Failed to get Thanks.io settings:', error.message);
    return {
      apiKey: null,
      accountEmail: null,
      partnerConfirmed: false,
      isConnected: false,
    };
  }
}

/**
 * Save or update tenant's Thanks.io integration settings.
 *
 * @param userId - Cognito user ID (sub)
 * @param settings - Personal API key and optional referral details
 */
export async function saveThanksIoSettings(
  userId: string,
  settings: {
    apiKey: string;
    accountEmail?: string;
    partnerConfirmed?: boolean;
  },
): Promise<boolean> {
  try {
    const account = await getUserAccount(userId);
    if (!account) {
      console.error(`❌ [THANKS.IO DAL] No user account found for user ${userId}`);
      return false;
    }

    const updated = await updateUserAccount(account.id, {
      thanksIoApiKey: settings.apiKey.trim(),
      thanksIoAccountEmail: settings.accountEmail?.trim() || account.thanksIoAccountEmail,
      thanksIoPartnerConfirmed: settings.partnerConfirmed ?? true,
    });

    return !!updated;
  } catch (error: any) {
    console.error('❌ [THANKS.IO DAL] Failed to save Thanks.io settings:', error.message);
    return false;
  }
}

/**
 * Disconnect tenant's Thanks.io integration.
 *
 * @param userId - Cognito user ID (sub)
 */
export async function deleteThanksIoSettings(userId: string): Promise<boolean> {
  try {
    const account = await getUserAccount(userId);
    if (!account) return false;

    const updated = await updateUserAccount(account.id, {
      thanksIoApiKey: '',
      thanksIoPartnerConfirmed: false,
    });

    return !!updated;
  } catch (error: any) {
    console.error('❌ [THANKS.IO DAL] Failed to disconnect Thanks.io:', error.message);
    return false;
  }
}
