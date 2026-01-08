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
    try {
      const user = await AuthGetCurrentUserServer();
      
      if (!user) {
        console.error('No authenticated user found');
        return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=user_not_authenticated');
      }

      // Store tokens in database using DynamoDB client
      const ghlIntegration = {
        id: `${user.userId}-${locationId || 'default'}`,
        userId: user.userId,
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

      console.log('✅ Tokens stored successfully for user:', user.userId);
    } catch (userError) {
      console.error('Error getting user or storing tokens:', userError);
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=user_error');
    }

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
