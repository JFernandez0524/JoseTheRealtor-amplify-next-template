'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// Prevent reconfiguration during hot reload
if (!(Amplify as any)._configured) {
  Amplify.configure(outputs);
  (Amplify as any)._configured = true;
}

export { Amplify };
