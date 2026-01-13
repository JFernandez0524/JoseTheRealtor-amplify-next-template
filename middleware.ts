import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // 1. Define Public Paths
  const publicPaths = [
    '/login', 
    '/signup', 
    '/pricing', 
    '/about', 
    '/services', 
    '/contact',
    '/docs',
    '/logout',
    '/forgot-password'
  ];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // 2. Bypass for Public Paths, API routes, and Webhooks
  if (
    isPublicPath ||
    pathname.startsWith('/api/') ||
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
  /*
   * Match all paths except static files, images, and favicon
   * Let the middleware handle route-specific logic
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
