import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_REDIRECT_URI = process.env.GHL_REDIRECT_URI || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/v1/oauth/callback'
    : 'https://leads.josetherealtor.com/api/v1/oauth/callback');

// Required scopes for your app
const SCOPES = [
  'contacts.readonly',
  'contacts.write',
  'locations/tags.write',
  'conversations/message.readonly',
  'conversations/message.write'
].join(' ');

export async function GET(req: Request) {
  try {
    if (!GHL_CLIENT_ID) {
      throw new Error('GHL_CLIENT_ID is missing');
    }

    // Get current user to include in state
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.redirect('https://leads.josetherealtor.com/oauth/error?error=user_not_authenticated');
    }

    // Generate state with user ID encoded
    const stateData = {
      userId: user.userId,
      nonce: randomBytes(16).toString('hex')
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // Build GHL authorization URL
    const authUrl = new URL('https://marketplace.leadconnectorhq.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', GHL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GHL_REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', state);

    console.log('Redirecting to GHL OAuth for user:', user.userId);
    console.log('OAuth URL:', authUrl.toString());
    console.log('Redirect URI being used:', GHL_REDIRECT_URI);

    // Redirect user to GHL for authorization
    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error('OAuth start error:', error);
    return NextResponse.json(
      { error: 'OAuth initialization failed', details: error.message },
      { status: 500 }
    );
  }
}
