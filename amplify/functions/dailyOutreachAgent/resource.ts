import { defineFunction } from '@aws-amplify/backend';

export const dailyOutreachAgent = defineFunction({
  name: 'dailyOutreachAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  memoryMB: 512,
  environment: {
    GHL_INTEGRATION_TABLE: process.env.GHL_INTEGRATION_TABLE || 'GhlIntegration-Default',
    API_ENDPOINT: process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  },
  // Run every hour from 9 AM - 7 PM EST (14:00-23:00 UTC)
  schedule: '0 14-23 * * ? *'
});

