import { defineFunction } from '@aws-amplify/backend';

export const dailyOutreachAgent = defineFunction({
  name: 'dailyOutreachAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes (allows 2-3 messages per run with 5-min delays)
  memoryMB: 512,
  environment: {
    GHL_INTEGRATION_TABLE: process.env.GHL_INTEGRATION_TABLE || 'GhlIntegration-Default',
    API_ENDPOINT: process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com'
  },
  // Run every hour from 9 AM - 7 PM EST (14:00-23:00 UTC)
  // 11 runs/day × ~10 contacts/run = ~110 contacts/day with 5-min delays
  schedule: '0 14-23 * * ? *'
});

