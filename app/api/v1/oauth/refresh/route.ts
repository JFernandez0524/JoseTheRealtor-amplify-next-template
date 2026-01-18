import { NextResponse } from 'next/server';
import { refreshGhlToken, getGhlIntegration } from '@/app/utils/aws/data/ghlIntegration.server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

/**
 * MANUAL GHL TOKEN REFRESH ENDPOINT
 * 
 * Manually refreshes a user's GHL OAuth token.
 * Normally tokens auto-refresh, but this endpoint allows manual refresh.
 * 
 * WORKFLOW:
 * 1. Authenticate user
 * 2. Get user's GHL integration
 * 3. Refresh the OAuth token
 * 4. Return new access token
 * 
 * USAGE:
 * POST /api/v1/oauth/refresh
 * 
 * NOTE: Tokens auto-refresh in getValidGhlToken(), so this is rarely needed.
 * 
 * RELATED FILES:
 * - app/utils/aws/data/ghlIntegration.server.ts - Token management utilities
 */

export async function POST(req: Request) {
  try {
    // Get current user
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's integration
    const integration = await getGhlIntegration(user.userId);
    if (!integration || !integration.refreshToken) {
      return NextResponse.json(
        { error: 'GHL integration not found' },
        { status: 404 }
      );
    }

    // Refresh the token
    const newAccessToken = await refreshGhlToken(integration.id, integration.refreshToken);
    
    if (!newAccessToken) {
      return NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      access_token: newAccessToken
    });

  } catch (error: any) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
