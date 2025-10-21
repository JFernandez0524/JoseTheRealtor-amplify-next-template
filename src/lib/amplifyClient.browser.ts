// src/lib/amplifyClient.browser.ts
'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// ✅ Guard against re-configuring Amplify during HMR / Fast Refresh
if (!(Amplify as any)._configured) {
  Amplify.configure(outputs);
  (Amplify as any)._configured = true;
}

export { Amplify };
