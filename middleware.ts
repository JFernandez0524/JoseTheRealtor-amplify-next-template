import { fetchAuthSession } from 'aws-amplify/auth/server';
import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/app/utils/amplifyServerUtils.server';

export async function middleware(request: NextRequest) {
  // 👇 ADD THIS LINE
  console.log(
    `--- MIDDLEWARE RUNNING for path: ${request.nextUrl.pathname} ---`
  );

  const response = NextResponse.next();

  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        // This will throw an error if no user is found
        const session = await fetchAuthSession(contextSpec);

        // Check if tokens exist to confirm authentication
        return session.tokens !== undefined;
      } catch (error) {
        console.log('Auth middleware error:', error);
        return false;
      }
    },
  });

  // If authenticated, let the request go through
  if (authenticated) {
    return response;
  }

  // // User is NOT authenticated. Check if it's an API route.
  // const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // if (isApiRoute) {
  //   // For API routes, return a 401 JSON error response
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  // For all other protected routes (pages), redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (the login page itself, to avoid redirect loops)
     */
    // '/((?!_next/static|_next/image|favicon.ico|login).*)',
    // '/((?!_next/static|_next/image|favicon.ico|login|/$).*)',
    // 1. Protect all API routes
    '/api/:path*',

    // 2. Protect your private pages
    '/dashboard/:path*',
    '/profile/:path*',
    '/upload/:path*',
  ],
};
