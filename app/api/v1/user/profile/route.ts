import { NextResponse } from 'next/server';
import {
  AuthGetCurrentUserServer,
  AuthGetUserAttributesServer,
  AuthGetUserGroupsServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { getOrCreateUserAccount } from '@/app/utils/aws/data/userAccount.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const currentUser = await AuthGetCurrentUserServer();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [attributes, groups] = await Promise.all([
      AuthGetUserAttributesServer(),
      AuthGetUserGroupsServer(),
    ]);

    const userEmail = attributes?.email || '';
    const userId = currentUser.userId;

    // Retrieve client IP for audit/starter account creation
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : '0.0.0.0';

    const account = await getOrCreateUserAccount(userId, userEmail, clientIP);

    const isPro = groups.includes('PRO') || groups.includes('AI_PLAN');
    const isAdmin = groups.includes('ADMINS');
    const isAI = groups.includes('AI_PLAN');
    const hasPaidPlan = isPro || isAdmin || isAI;

    return NextResponse.json({
      success: true,
      userId,
      email: userEmail,
      credits: account?.credits ?? 5,
      groups,
      isPro,
      isAdmin,
      isAI,
      hasPaidPlan,
      ghlIntegrationType: account?.ghlIntegrationType || 'NONE',
    });
  } catch (error: any) {
    console.error('Error in /api/v1/user/profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
