import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // 1. Define Public Paths
  const publicPaths = ['/login', '/signup', '/pricing', '/forgot-password'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // 2. Bypass for Public Paths and Webhooks
  if (
    isPublicPath ||
    pathname.startsWith('/api/webhooks') ||
    pathname === '/'
  ) {
    return response;
  }

  // 3. Simple Auth Check using your server runner logic
  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return !!(session.tokens?.accessToken && session.tokens?.idToken);
      } catch {
        return false;
      }
    },
  });

  // 4. Redirect to login if trying to access a protected route without a session
  if (!authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except webhooks, static files, images, and favicon
     */
    '/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)',
  ],
};
