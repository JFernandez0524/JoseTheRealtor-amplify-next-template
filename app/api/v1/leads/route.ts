import { NextResponse } from 'next/server';
import {
  AuthIsUserAuthenticatedServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { listLeads } from '@/app/utils/aws/data/lead.server';
/**
 * GET: Fetches all leads owned by the authenticated user
 */
export async function GET() {
  const authenticated = await AuthIsUserAuthenticatedServer();
  if (!authenticated) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    // 'owner' rule in schema automatically filters to this user
    // We sort by createdAt, newest first
    const leads = await listLeads();
    return NextResponse.json({ success: true, leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
