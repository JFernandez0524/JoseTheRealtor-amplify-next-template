import { defineFunction } from '@aws-amplify/backend';

export const inboundMessagePoller = defineFunction({
  name: 'inboundMessagePoller',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes
  memoryMB: 512,
  environment: {
    GHL_INTEGRATION_TABLE: process.env.GHL_INTEGRATION_TABLE || 'GhlIntegration-Default',
    API_ENDPOINT: process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com'
  },
  // Run every 10 minutes during business hours
  schedule: 'rate(10 minutes)'
});
