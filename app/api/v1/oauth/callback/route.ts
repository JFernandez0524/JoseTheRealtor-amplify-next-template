import { NextResponse } from 'next/server';
import axios from 'axios';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

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

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=' + error);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=no_code');
    }

    // TODO: Verify state parameter for security
    // if (!verifyState(state)) {
    //   return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=invalid_state');
    // }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        user_type: 'Location', // Request Location-level token
        redirect_uri: GHL_REDIRECT_URI
      },
      {
        headers: {
          'Content-Type': 'application/json', // Use JSON, not form-encoded
          'Accept': 'application/json'
        }
      }
    );

    const {
      access_token,
      refresh_token,
      locationId,
      companyId,
      userId,
      userType,
      expires_in
    } = tokenResponse.data;

    console.log('OAuth success for location:', locationId);

    // Get current user for token storage
    const user = await getFrontEndUser();
    if (!user) {
      console.error('No authenticated user found');
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=user_not_authenticated');
    }

    // Store tokens in database
    await client.models.GhlIntegration.create({
      userId: user.userId,
      locationId: locationId || 'default',
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + (expires_in * 1000)).toISOString(),
      scope: 'contacts.readonly contacts.write locations/tags.write conversations/message.readonly conversations/message.write',
      isActive: true,
    });

    console.log('✅ Tokens stored successfully for user:', user.userId);

    // Redirect to success page
    return NextResponse.redirect('https://leads.josetherealtor.com/oauth/success?locationId=' + locationId);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    
    // Log detailed error for debugging
    if (error.response) {
      console.error('GHL API Error:', error.response.status, error.response.data);
    }

    return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=token_exchange_failed');
  }
}
