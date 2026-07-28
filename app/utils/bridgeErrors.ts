// app/utils/bridgeErrors.ts
//
// Pure error classification for the Bridge (Zillow) API. Deliberately separate from
// `bridge.server.ts`, which throws at import time when BRIDGE_API_KEY is unset and therefore can't
// be imported by unit tests. Consumed by `bridge.server.ts`; tested in
// `__tests__/shared/bridgeErrors.test.ts`.
import axios from 'axios';

export type BridgeErrorInfo = {
  status: number | null;
  /** 401/403 — the credential itself is bad, so every subsequent request will fail identically. */
  isAuthFailure: boolean;
  message: string;
};

/**
 * Work out what a failed Bridge request actually was. Every catch in `bridge.server.ts` routes
 * through here so a credential outage produces one readable log line instead of a bare street name.
 *
 * Bridge returns `{ success, status, bundle: { name, message } }` on error — note `bundle` is an
 * *object* there but an *array* on success, so the message is read defensively.
 *
 * Anything that isn't a 401/403 must classify as `isAuthFailure: false`: that flag trips a circuit
 * breaker that abandons Zestimate lookups for a whole CSV import, so a false positive silently
 * drops valuations for every remaining row.
 */
export function classifyBridgeError(err: unknown): BridgeErrorInfo {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? null;
    const body: any = err.response?.data;
    // `bundle` is an array on success; only read `.message` when it's a plain error object.
    const bundleMessage =
      body?.bundle && !Array.isArray(body.bundle) ? body.bundle.message : undefined;
    return {
      status,
      isAuthFailure: status === 401 || status === 403,
      message: bundleMessage || body?.message || err.message || 'Unknown Bridge error',
    };
  }

  // Non-axios throw (programming error, or a transport failure surfaced by something else).
  // Never treat these as auth failures — a DNS blip must not disable Zestimates for a whole run.
  return {
    status: null,
    isAuthFailure: false,
    message: err instanceof Error ? err.message : String(err ?? 'Unknown Bridge error'),
  };
}

/** Format a classified error for logging: `401 Unauthorized request`. */
export function describeBridgeError(err: unknown): string {
  const { status, message } = classifyBridgeError(err);
  return status ? `${status} ${message}` : message;
}
