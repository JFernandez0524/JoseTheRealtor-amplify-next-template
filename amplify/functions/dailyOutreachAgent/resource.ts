import { defineFunction, secret } from '@aws-amplify/backend';

export const dailyOutreachAgent = defineFunction({
  name: 'dailyOutreachAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  memoryMB: 512,
  environment: {
    GHL_INTEGRATION_TABLE: process.env.GHL_INTEGRATION_TABLE || 'GhlIntegration-Default',
    API_ENDPOINT: process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com'
  }
});

// Schedule to run daily at 9 AM EST (14:00 UTC)
// Note: Use EventBridge rule separately if needed
// schedule: 'rate(1 day)' // Alternative: run every 24 hours
