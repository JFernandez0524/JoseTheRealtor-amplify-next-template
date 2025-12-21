import { fetchAuthSession } from 'aws-amplify/auth/server';
import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  const authData = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        if (!session.tokens) return { authenticated: false, groups: [] };
        // Extract groups from the access token
        const groups =
          (session.tokens.accessToken.payload['cognito:groups'] as string[]) ||
          [];
        return { authenticated: true, groups };
      } catch (error) {
        return { authenticated: false, groups: [] };
      }
    },
  });

  // Redirect to login if not authenticated
  if (!authData.authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isPro = authData.groups.includes('PRO');
  const isAdmin = authData.groups.includes('ADMINS');

  const hasPremiumAccess = isPro || isAdmin;

  // Protect the dashboard and upload paths
  const premiumPaths = ['/dashboard', '/upload', '/profile'];
  const isPremiumPath = premiumPaths.some((p) => path.startsWith(p));

  if (isPremiumPath && !hasPremiumAccess) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/upload/:path*',
    '/api/((?!v1/analyze-property).*)',
  ],
};
