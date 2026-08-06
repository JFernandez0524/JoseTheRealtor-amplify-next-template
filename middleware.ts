import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/app/utils/aws/auth/amplifyServerUtils.server';

import { checkRateLimit } from '@/app/utils/rateLimiter';

function getRateLimitConfig(pathname: string): { limit: number; windowMs: number } | null {
  // Exclude GHL webhooks from standard IP rate limits (they carry RSA signature verification)
  if (pathname.startsWith('/api/v1/ghl-webhook') || pathname.startsWith('/api/v1/ghl-app-install')) {
    return null;
  }
  // Heavy actions: 10 requests per minute
  if (
    pathname.startsWith('/api/v1/enrich-leads') ||
    pathname.startsWith('/api/v1/upload-leads') ||
    pathname.startsWith('/api/v1/bulk-delete-leads')
  ) {
    return { limit: 10, windowMs: 60_000 };
  }
  // OAuth security: 20 requests per minute
  if (pathname.startsWith('/api/v1/oauth/')) {
    return { limit: 20, windowMs: 60_000 };
  }
  // Standard API routes: 60 requests per minute
  return { limit: 60, windowMs: 60_000 };
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // 1. API Route Rate Limiting
  if (pathname.startsWith('/api/')) {
    const rateConfig = getRateLimitConfig(pathname);
    if (rateConfig) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      const result = checkRateLimit(`${clientIp}:${pathname}`, rateConfig);

      if (!result.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please slow down.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(result.retryAfter),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }
    }
    return response;
  }

  // 2. Define Public Paths
  const publicPaths = [
    '/login', 
    '/signup', 
    '/pricing', 
    '/about', 
    '/services', 
    '/contact',
    '/docs',
    '/logout',
    '/forgot-password',
    '/cost-breakdown',
    '/privacy-policy',
    '/terms-of-service',
    '/cookie-policy',
    '/compliance',
    '/tcpa-compliance',
    '/unsubscribe',
    '/oauth',
  ];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // 3. Bypass for Public Paths and Root
  if (isPublicPath || pathname === '/') {
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
