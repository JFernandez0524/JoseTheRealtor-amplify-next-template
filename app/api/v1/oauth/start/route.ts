/**
 * GET /api/v1/oauth/start
 *
 * Initiates the GoHighLevel OAuth flow. Builds the GHL authorization URL with
 * a signed HMAC state parameter (encodes userId + timestamp) and redirects the
 * user to the GHL consent screen.
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST: No params
 * RESPONSE: 302 redirect → GHL OAuth authorization URL
 *
 * OAUTH FLOW:
 * 1. User clicks "Connect GHL" → hits this endpoint
 * 2. State token created: HMAC(userId + timestamp) — expires in 15 min
 * 3. Browser redirected to GHL consent page
 * 4. After approval, GHL redirects to /api/v1/oauth/callback
 *
 * SCOPES: Full GHL permission set (contacts, conversations, calendars, etc.)
 * RELATED: app/api/v1/oauth/callback/route.ts
 */
import { NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'crypto';
import { AuthGetCurrentUserServer, AuthGetUserGroupsServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_STATE_SECRET = process.env.GHL_STATE_SECRET!;
const GHL_REDIRECT_URI = process.env.GHL_REDIRECT_URI || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/v1/oauth/callback'
    : 'https://leads.josetherealtor.com/api/v1/oauth/callback');

const SCOPES = [
  'associations.write',
  'associations.readonly',
  'associations/relation.readonly',
  'associations/relation.write',
  'calendars.readonly',
  'calendars.write',
  'calendars/events.readonly',
  'calendars/events.write',
  'calendars/groups.readonly',
  'calendars/groups.write',
  'calendars/resources.readonly',
  'calendars/resources.write',
  'campaigns.readonly',
  'contacts.readonly',
  'contacts.write',
  'conversation-ai.readonly',
  'conversation-ai.write',
  'conversations.readonly',
  'conversations.write',
  'conversations/message.readonly',
  'conversations/message.write',
  'conversations/reports.readonly',
  'conversations/livechat.write',
  'locations/customFields.readonly',
  'locations/customFields.write',
  'emails/builder.write',
  'emails/builder.readonly',
  'emails/schedule.readonly',
  'emails/schedule.write',
  'emails/templates.readonly',
  'emails/templates.write',
  'emails/campaigns.readonly',
  'emails/campaigns.write',
  'emails/stats.readonly',
  'locations.readonly',
  'locations/customValues.readonly',
  'locations/customValues.write',
  'locations/tasks.readonly',
  'locations/tasks.write',
  'recurring-tasks.readonly',
  'recurring-tasks.write',
  'locations/tags.readonly',
  'locations/tags.write',
  'locations/templates.readonly',
  'opportunities.readonly',
  'opportunities.write',
  'phonenumbers.read',
  'phonenumbers.write',
  'numberpools.read',
  'users.readonly',
  'workflows.readonly',
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

    // Require a paid plan to connect GHL
    const groups = await AuthGetUserGroupsServer();
    const hasPaidPlan = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');
    if (!hasPaidPlan) {
      return NextResponse.redirect('https://leads.josetherealtor.com/pricing');
    }

    // Build a signed state token — prevents CSRF / account-takeover via crafted state.
    // Signed payload: "userId|nonce|timestamp" — deterministic order avoids JSON key issues.
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const sigPayload = `${user.userId}|${nonce}|${timestamp}`;
    const sig = createHmac('sha256', GHL_STATE_SECRET).update(sigPayload).digest('hex');
    const state = Buffer.from(JSON.stringify({ userId: user.userId, nonce, timestamp, sig })).toString('base64url');
    
    // Build GHL authorization URL (v2 marketplace endpoint requires version_id)
    const authUrl = new URL('https://marketplace.gohighlevel.com/v2/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', GHL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GHL_REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', state);
    // version_id is the app ID portion of client_id (before the first dash)
    const versionId = GHL_CLIENT_ID.split('-')[0];
    authUrl.searchParams.set('version_id', versionId);

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
