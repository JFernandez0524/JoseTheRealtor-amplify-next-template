import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/src/utils/amplifyServerUtils.server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`🔒 [Middleware] Running on: ${pathname}`);

  const response = NextResponse.next();

  try {
    const authenticated = await runWithAmplifyServerContext({
      nextServerContext: { request, response },
      operation: async (contextSpec) => {
        try {
          const session = await fetchAuthSession(contextSpec, {});
          console.log(session.identityId);
          const isAuthed = !!session.tokens?.idToken;
          console.log(
            `✅ [Middleware] ${pathname} → Authenticated: ${isAuthed}`
          );
          return isAuthed;
        } catch (error) {
          console.warn(`⚠️ [Middleware] Error fetching session on ${pathname}`);
          console.error(error);
          return false;
        }
      },
    });

    // 🔐 Redirect unauthenticated users to Amplify’s SSR sign-in route
    if (!authenticated) {
      console.log(
        `🚫 [Middleware] Redirecting unauthenticated → /api/auth/sign-in`
      );

      const signInUrl = new URL('/api/auth/sign-in', request.url);
      signInUrl.searchParams.set('redirectTo', pathname); // Optional: return user after login

      return NextResponse.redirect(signInUrl);
    }

    return response;
  } catch (error) {
    console.error(`❌ [Middleware] Unexpected error on ${pathname}`, error);

    const signInUrl = new URL('/api/auth/sign-in', request.url);
    signInUrl.searchParams.set('redirectTo', pathname);

    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login
     */
    '/protected/:path*',
    '/dashboard/:path*',
    '/upload/:path*',
    '/profile/:path*',
    '/assistant/:path*',
    '/api/v1/:path*',
    // '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
