'use client';

import { useState } from 'react';
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
  const [connecting, setConnecting] = useState(false);

  // Only nag users who are supposed to have GHL connected.
  if (isLoading || isConnected || !hasPaidPlan) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm font-medium">
          ⚠️ <strong>Launch AI isn&apos;t connected.</strong>{' '}
          Your leads aren&apos;t syncing and outreach is paused — reconnect to resume.
        </p>
        <button
          onClick={() => {
            setConnecting(true);
            window.location.href = '/api/v1/oauth/start';
          }}
          disabled={connecting}
          className="shrink-0 inline-flex items-center gap-1.5 bg-white text-red-700 text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-75 transition-colors"
        >
          {connecting && (
            <svg className="w-3.5 h-3.5 animate-spin text-red-700" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {connecting ? 'Redirecting...' : 'Connect Launch AI'}
        </button>
      </div>
    </div>
  );
}
