// src/lib/parseJwt.ts

/**
 * Decodes a JWT without verifying its signature.
 * Useful for extracting Cognito user claims (sub, email, etc.)
 * on trusted server-side routes that already receive verified tokens.
 */
export function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('JWT parse error:', error);
    return null;
  }
}
