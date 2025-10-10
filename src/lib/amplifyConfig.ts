// src/lib/amplifyConfig.ts (configure once in root layout)
import { Amplify } from 'aws-amplify';
import config from '../../amplify_outputs.json';

// This works for both client and server with Next.js
Amplify.configure(config, {
  ssr: true, // Next.js handles this properly
});
