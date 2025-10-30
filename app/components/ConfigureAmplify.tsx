'use client';

import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

// 1. Configure Amplify ONCE for the browser.
//    { ssr: true } = "use the secure auth cookies from the Next.js adapter"
Amplify.configure(outputs, { ssr: true });

// 4. Tiny component injected at the top of <body /> in layout
export default function ConfigureAmplifyClientSide() {
  return null;
}
