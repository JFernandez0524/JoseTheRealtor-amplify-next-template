import { defineFunction, secret } from '@aws-amplify/backend';

export const skipTraceLeads = defineFunction({
  name: 'skipTraceLeads',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes (plenty of time for batching)
  resourceGroupName: 'data',
  environment: {
    // Make sure to add this Key in your Amplify Console or .env file
    // 🔒 SECURE: Use secret() to inject the value at runtime
    BATCH_DATA_SERVER_TOKEN: secret('BATCH_DATA_SERVER_TOKEN'),
  },
});
