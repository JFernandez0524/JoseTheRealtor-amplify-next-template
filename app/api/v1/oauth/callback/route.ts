import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
      console.log('Raw state parameter:', state);
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      console.log('Parsed state data:', stateData);
      
      if (!stateData.userId) {
        throw new Error('No user ID in state');
      }
      
      userId = stateData.userId;
      console.log('Extracted user ID from state:', userId);
    } catch (stateError) {
      console.error('State parsing error:', stateError);
      console.error('State value was:', state);
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

      // Store tokens in database using DynamoDB client
      const ghlIntegration = {
        id: `${userId}-${locationId || 'default'}`,
        userId: userId,
        locationId: locationId || 'default',
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + (expires_in * 1000)).toISOString(),
        scope: 'contacts.readonly contacts.write locations/tags.write conversations/message.readonly conversations/message.write',
        isActive: true,
        dailyMessageCount: 0,
        hourlyMessageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await docClient.send(new PutCommand({
        TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
        Item: ghlIntegration
      }));

      console.log('✅ Tokens stored successfully for user:', userId);
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
