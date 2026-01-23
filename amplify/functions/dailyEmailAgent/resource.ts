import { defineFunction } from '@aws-amplify/backend';

export const dailyEmailAgent = defineFunction({
  name: 'dailyEmailAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  environment: {
    AMPLIFY_DATA_GhlIntegration_TABLE_NAME: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || '',
    APP_URL: process.env.APP_URL || 'https://leads.josetherealtor.com',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  },
  schedule: 'every 1h', // Run every hour, business hours check inside handler
});
