import { defineFunction } from '@aws-amplify/backend';

export const ghlWebhookHandler = defineFunction({
  name: 'ghlWebhookHandler',
  entry: './handler.ts',
  timeoutSeconds: 60,
  environment: {
    GHL_CLIENT_ID: process.env.GHL_CLIENT_ID || '',
    GHL_CLIENT_SECRET: process.env.GHL_CLIENT_SECRET || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    BRIDGE_API_KEY: process.env.BRIDGE_API_KEY || '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://leads.josetherealtor.com',
  }
});
