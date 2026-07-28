/**
 * GHL CONVERSATION MESSAGE PARSING
 *
 * Pure helpers for reading `GET /conversations/{id}/messages` responses. Kept in their own
 * side-effect-free module so they can be unit-tested (`__tests__/shared/ghlMessages.test.ts`).
 *
 * WHY THIS EXISTS: the response nests the array two levels deep —
 *
 *   { "messages": { "lastMessageId": "…", "nextPage": false, "messages": [ … ] } }
 *
 * Four separate call sites read `data.messages` (the wrapper object) instead of
 * `data.messages.messages`, and each degraded differently and silently: the AI's conversation
 * history was always empty, the manual-takeover detector always returned false, Instagram
 * empty-body recovery never worked, and the media-message guard never fired. Parsing the shape in
 * one tested place is the point of this module.
 */

/** The subset of a GHL message we actually rely on. Extra fields pass through untouched. */
export interface GhlMessage {
  id?: string;
  body?: string;
  direction?: 'inbound' | 'outbound' | string;
  /** Numeric channel code (2 = SMS). NOT the `TYPE_*` string — that is `messageType`. */
  type?: number;
  messageType?: string;
  contentType?: string;
  dateAdded?: string;
  source?: string;
  meta?: { marketplace?: { appId?: string; appName?: string } };
  [key: string]: unknown;
}

/**
 * Extract the message array from a conversations-messages response body.
 *
 * Accepts the documented nested shape, tolerates a flat `messages` array in case the API varies by
 * version or endpoint, and returns `[]` for anything unrecognised rather than throwing — callers
 * treat "no history" as a degraded-but-survivable state, not a crash.
 */
export function extractGhlMessages(responseData: unknown): GhlMessage[] {
  if (!responseData || typeof responseData !== 'object') return [];

  const outer = (responseData as { messages?: unknown }).messages;

  // Documented shape: { messages: { messages: [...] } }
  if (outer && typeof outer === 'object' && !Array.isArray(outer)) {
    const inner = (outer as { messages?: unknown }).messages;
    return Array.isArray(inner) ? (inner as GhlMessage[]) : [];
  }

  // Tolerated legacy/flat shape: { messages: [...] }
  if (Array.isArray(outer)) return outer as GhlMessage[];

  return [];
}

/**
 * Whether an outbound message was sent by a human in the GHL UI, as opposed to by this app's AI or
 * by a GHL workflow.
 *
 * This distinction is load-bearing for the manual-takeover detector: without it, the AI's own reply
 * from seconds earlier reads as "recent manual activity" and pauses the agent on every
 * conversation. Inbound messages are never human-outbound.
 *
 * Observed markers on live payloads:
 * - this app's AI  → `meta.marketplace.appName` present (e.g. "Lead Manager")
 * - GHL automation → `source: "workflow"`
 * - a human        → neither
 */
export function isHumanOutbound(msg: GhlMessage | null | undefined): boolean {
  if (!msg || msg.direction !== 'outbound') return false;
  if (msg.meta?.marketplace) return false; // sent by an installed app — i.e. us
  if (msg.source === 'workflow') return false; // sent by a GHL automation
  return true;
}

/**
 * Whether a message is a GHL system/activity entry rather than real conversation content.
 *
 * Note the `TYPE_*` string lives on `messageType`; `type` is a numeric channel code, so comparing
 * `type` to a string (as earlier code did) is always true and filters nothing.
 */
export function isSystemMessage(msg: GhlMessage | null | undefined): boolean {
  const t = msg?.messageType;
  return typeof t === 'string' && (t === 'TYPE_SYSTEM' || t.startsWith('TYPE_ACTIVITY'));
}
