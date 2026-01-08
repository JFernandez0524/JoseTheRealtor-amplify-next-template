import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

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

    // Generate state for security
    const state = randomBytes(32).toString('hex');
    
    // Store state in session/database for verification (simplified for now)
    // TODO: Store state properly for production
    
    // Build GHL authorization URL
    const authUrl = new URL('https://marketplace.leadconnectorhq.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', GHL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GHL_REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', state);

    console.log('Redirecting to GHL OAuth:', authUrl.toString());

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
