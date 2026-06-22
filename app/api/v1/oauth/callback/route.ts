import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { createGhlIntegration, getGhlIntegration } from '@/app/utils/aws/data/ghlIntegration.server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { provisionCustomFields, provisionOpportunityFields } from '@/amplify/functions/shared/ghlFieldProvisioner';

const GHL_STATE_SECRET = process.env.GHL_STATE_SECRET!;
const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes — enough time for a user to complete OAuth

/**
 * GHL OAUTH CALLBACK HANDLER
 * 
 * Handles the OAuth callback from GoHighLevel after user authorization.
 * Exchanges authorization code for access/refresh tokens and stores them.
 * 
 * OAUTH FLOW:
 * 1. User clicks "Connect GHL" in app
 * 2. Redirected to GHL OAuth page
 * 3. User authorizes app
 * 4. GHL redirects here with authorization code
 * 5. Exchange code for tokens
 * 6. Store tokens in database
 * 7. Redirect to success page
 * 
 * STATE PARAMETER:
 * Contains base64-encoded JSON with userId for security.
 * Prevents CSRF attacks and links OAuth to correct user.
 * 
 * RELATED FILES:
 * - app/utils/aws/data/ghlIntegration.server.ts - Token storage
 * - app/components/dashboard/GhlConnection.tsx - Initiates OAuth flow
 */

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_REDIRECT_URI = process.env.GHL_REDIRECT_URI || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/v1/oauth/callback'
    : 'https://leads.josetherealtor.com/api/v1/oauth/callback');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('OAuth callback received:', { code: !!code, state, error });

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error from GHL:', error);
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=' + error);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=no_code');
    }

    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      console.error('Missing GHL credentials');
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=missing_credentials');
    }

    // Extract user ID from state parameter
    if (!state) {
      console.error('No state parameter provided');
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=invalid_state');
    }

    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId: uid, nonce, timestamp, sig } = stateData;

      if (!uid || !nonce || !timestamp || !sig) throw new Error('Incomplete state fields');

      // Reject expired state tokens (user took more than 15 minutes on the OAuth screen)
      if (Date.now() - timestamp > STATE_MAX_AGE_MS) {
        throw new Error('State token expired');
      }

      // Verify HMAC — same canonical payload used in oauth/start
      const sigPayload = `${uid}|${nonce}|${timestamp}`;
      const expected = createHmac('sha256', GHL_STATE_SECRET).update(sigPayload).digest('hex');
      const sigBuf = Buffer.from(sig.padEnd(expected.length));
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('State HMAC verification failed');
      }

      userId = uid;
      console.log('State verified for user:', userId);
    } catch (stateError) {
      console.error('State verification error:', stateError);
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=invalid_state');
    }

    console.log('Attempting token exchange with GHL...');

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id: GHL_CLIENT_ID!,
        client_secret: GHL_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        user_type: 'Location',
        redirect_uri: GHL_REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const {
      access_token,
      refresh_token,
      locationId,
      companyId,
      userId: ghlUserId,
      userType,
      expires_in
    } = tokenResponse.data;

    console.log('OAuth success for location:', locationId);

    // Use user ID from state parameter instead of server auth
    try {
      console.log('Using user ID from state:', userId);

      // Store tokens using utility function
      await createGhlIntegration(userId, {
        access_token,
        refresh_token,
        expires_in,
        locationId
      });

      console.log('✅ Tokens stored successfully for user:', userId);

      // Provision custom fields for the new location and store the IDs
      try {
        console.log('🔧 Provisioning custom fields for location:', locationId);
        const [customFieldIds, opportunityFieldIds] = await Promise.all([
          provisionCustomFields(locationId, access_token),
          provisionOpportunityFields(locationId, access_token),
        ]);

        const integration = await getGhlIntegration(userId);
        if (integration) {
          await cookiesClient.models.GhlIntegration.update({
            id: integration.id,
            customFieldIds: customFieldIds as any,
            opportunityFieldIds: opportunityFieldIds as any,
          });
          console.log('✅ Custom field IDs stored for integration:', integration.id);
        }
      } catch (provisionError: any) {
        // Non-fatal: sync will fall back to auto-provision on first run
        console.error('⚠️ Field provisioning failed (non-fatal):', provisionError.message);
      }
    } catch (storageError) {
      console.error('Error storing tokens:', storageError);
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=storage_error');
    }

    // Redirect to success page
    return NextResponse.redirect('https://leads.josetherealtor.com/oauth/success?locationId=' + locationId);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    // Log detailed error for debugging
    if (error.response) {
      console.error('GHL API Error:', error.response.status, error.response.data);
    }

    return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=token_exchange_failed');
  }
}
