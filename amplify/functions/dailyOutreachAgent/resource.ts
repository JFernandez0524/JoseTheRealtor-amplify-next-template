import { defineFunction } from '@aws-amplify/backend';

export const dailyOutreachAgent = defineFunction({
  name: 'dailyOutreachAgent',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  memoryMB: 512,
  environment: {
    AMPLIFY_DATA_GhlIntegration_TABLE_NAME: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME || '',
    API_ENDPOINT: process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  }
  // SMS OUTREACH PERMANENTLY DISABLED - DO NOT RE-ENABLE WITHOUT FIXING DUPLICATE PREVENTION
});

