import { NextResponse } from 'next/server';
import axios from 'axios';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_REDIRECT_URI = 'https://JoseTheRealtor.com/api/v1/oauth/callback';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect('https://JoseTheRealtor.com/oauth/error?error=' + error);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect('https://JoseTheRealtor.com/oauth/error?error=no_code');
    }

    // TODO: Verify state parameter for security
    // if (!verifyState(state)) {
    //   return NextResponse.redirect('https://JoseTheRealtor.com/oauth/error?error=invalid_state');
    // }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: GHL_REDIRECT_URI
      },
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
      expires_in
    } = tokenResponse.data;

    console.log('OAuth success for location:', locationId);

    // TODO: Store tokens in database
    // await storeTokens({
    //   locationId,
    //   companyId,
    //   accessToken: access_token,
    //   refreshToken: refresh_token,
    //   expiresAt: new Date(Date.now() + expires_in * 1000)
    // });

    // For now, log the tokens (remove in production)
    console.log('Tokens received:', {
      locationId,
      companyId,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      expiresIn: expires_in
    });

    // Redirect to success page
    return NextResponse.redirect('https://JoseTheRealtor.com/oauth/success?locationId=' + locationId);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    
    // Log detailed error for debugging
    if (error.response) {
      console.error('GHL API Error:', error.response.status, error.response.data);
    }

    return NextResponse.redirect('https://JoseTheRealtor.com/oauth/error?error=token_exchange_failed');
  }
}
