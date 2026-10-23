import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { saveThanksIoSettings, deleteThanksIoSettings } from '@/app/utils/aws/data/thanksIoIntegration.server';
import { THANKS_IO_API_BASE } from '@/amplify/functions/shared/thanksIoRecipients';

/**
 * POST /api/v1/thanksio/connect
 * Body: { apiKey: string, accountEmail?: string }
 *
 * Validates the API token with Thanks.io, then saves it to the user's account.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const accountEmail = typeof body.accountEmail === 'string' ? body.accountEmail.trim() : undefined;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    // Verify the key directly against Thanks.io API before saving
    try {
      const verifyRes = await fetch(`${THANKS_IO_API_BASE}/mailing-lists`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: 'Invalid Thanks.io API key. Please check your token from your Thanks.io dashboard and try again.' },
          { status: 400 },
        );
      }
    } catch (testErr: any) {
      console.error('❌ [THANKS.IO] Verification request failed:', testErr.message);
      return NextResponse.json(
        { error: 'Could not reach Thanks.io API to verify your key. Please try again shortly.' },
        { status: 502 },
      );
    }

    // Save to user account
    const saved = await saveThanksIoSettings(user.userId, {
      apiKey,
      accountEmail,
      partnerConfirmed: true,
    });

    if (!saved) {
      return NextResponse.json({ error: 'Failed to save integration settings.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Thanks.io account connected successfully.',
    });
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Connect error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/thanksio/connect
 * Disconnects the user's Thanks.io integration.
 */
export async function DELETE() {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const disconnected = await deleteThanksIoSettings(user.userId);
    if (!disconnected) {
      return NextResponse.json({ error: 'Failed to disconnect Thanks.io.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Thanks.io disconnected.' });
  } catch (error: any) {
    console.error('❌ [THANKS.IO] Disconnect error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
