'use client';

import { useGhl } from '@/app/context/GhlContext';
import { useAccess } from '@/app/context/AccessContext';

/**
 * App-wide banner shown to paid users whose GoHighLevel integration is not
 * connected (missing, disconnected, or token expired). This is the user-facing
 * surface for the field-sync webhook's "unknown/inactive location" condition:
 * if GHL is firing events the app can't match to an active integration, the root
 * cause is a broken connection — so we prompt a reconnect. Owner-mismatch
 * rejections are a data anomaly handled via dev/admin alerting, not here.
 */
export default function GhlConnectionBanner() {
  const { isConnected, isLoading } = useGhl();
  const { hasPaidPlan } = useAccess();

  // Only nag users who are supposed to have GHL connected.
  if (isLoading || isConnected || !hasPaidPlan) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm font-medium">
          ⚠️ <strong>GoHighLevel isn&apos;t connected.</strong>{' '}
          Your leads aren&apos;t syncing and outreach is paused — reconnect to resume.
        </p>
        <a
          href="/api/v1/oauth/start"
          className="shrink-0 bg-white text-red-700 text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Connect GoHighLevel
        </a>
      </div>
    </div>
  );
}
