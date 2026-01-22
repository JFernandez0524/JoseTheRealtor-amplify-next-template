import { defineFunction } from '@aws-amplify/backend';

export const dailyEmailAgent = defineFunction({
  name: 'dailyEmailAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  environment: {
    GHL_INTEGRATION_TABLE_NAME: process.env.GHL_INTEGRATION_TABLE_NAME || '',
    APP_URL: process.env.APP_URL || 'https://leads.josetherealtor.com',
  },
  schedule: 'every 1h', // Run every hour, business hours check inside handler
});
