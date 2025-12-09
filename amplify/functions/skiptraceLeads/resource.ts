import { defineFunction, secret } from '@aws-amplify/backend';

export const skipTraceLeads = defineFunction({
  name: 'skipTraceLeads',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes (plenty of time for batching)
  environment: {
    // Make sure to add this Key in your Amplify Console or .env file
    // 🔒 SECURE: Use secret() to inject the value at runtime
    BATCH_DATA_API_KEY: secret('BATCH_DATA_API_KEY'),
    AMPLIFY_DATA_LEAD_TABLE_NAME:
      process.env.AMPLIFY_DATA_LEAD_TABLE_NAME || '',
  },
});
