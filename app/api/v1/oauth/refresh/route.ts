import { NextResponse } from 'next/server';
import axios from 'axios';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_REDIRECT_URI = 'https://JoseTheRealtor.com/api/v1/oauth/callback';

export async function POST(req: Request) {
  try {
    const { refreshToken, userType = 'Location' } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Refresh the access token
    const tokenResponse = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        user_type: userType,
        redirect_uri: GHL_REDIRECT_URI
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const {
      access_token,
      refresh_token: newRefreshToken,
      expires_in,
      locationId,
      companyId,
      userId
    } = tokenResponse.data;

    console.log('Token refreshed successfully for location:', locationId);

    // TODO: Update stored tokens in database
    // await updateStoredTokens({
    //   locationId,
    //   accessToken: access_token,
    //   refreshToken: newRefreshToken,
    //   expiresAt: new Date(Date.now() + expires_in * 1000)
    // });

    return NextResponse.json({
      success: true,
      access_token,
      refresh_token: newRefreshToken,
      expires_in,
      locationId,
      companyId,
      userId
    });

  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    if (error.response) {
      console.error('GHL API Error:', error.response.status, error.response.data);
      
      // Handle specific error cases
      if (error.response.status === 400) {
        return NextResponse.json(
          { error: 'Invalid refresh token' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
