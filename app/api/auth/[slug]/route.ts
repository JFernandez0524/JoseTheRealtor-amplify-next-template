// app/api/auth/[slug]/route.ts
import { createAuthRouteHandlers } from '../../../../src/utils/amplifyServerUtils.server';

export const GET = createAuthRouteHandlers({
  redirectOnSignInComplete: '/profile',
  redirectOnSignOutComplete: '/',
});
