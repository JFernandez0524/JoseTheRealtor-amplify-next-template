import { runWithAmplifyServerContext } from '../../../../src/utils/amplifyServerUtils.server';
import { NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (ctx) => fetchAuthSession(ctx),
    });

    if (!session?.tokens?.idToken) {
      return NextResponse.json({ user: null }, { status: 200 }); // ✅ safe null response
    }

    const payload = session.tokens.idToken.payload;
    const user = {
      username: payload['cognito:username'],
      email: payload.email,
      userId: payload.sub,
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json({ user: null }, { status: 200 }); // ✅ avoid throwing 401s on unauthenticated
  }
}
