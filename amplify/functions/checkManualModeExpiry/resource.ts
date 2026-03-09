import { defineFunction } from '@aws-amplify/backend';

export const checkManualModeExpiry = defineFunction({
  name: 'checkManualModeExpiry',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes
  environment: {
    GHL_CLIENT_ID: process.env.GHL_CLIENT_ID || '',
    GHL_CLIENT_SECRET: process.env.GHL_CLIENT_SECRET || '',
  },
  schedule: 'every 1h', // Run every hour to check for expired manual mode
});
