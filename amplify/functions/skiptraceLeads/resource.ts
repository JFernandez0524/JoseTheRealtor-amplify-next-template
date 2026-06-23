import { defineFunction, secret } from '@aws-amplify/backend';

export const skipTraceLeads = defineFunction({
  name: 'skipTraceLeads',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes (plenty of time for batching)
  resourceGroupName: 'data',
  environment: {
    BATCH_DATA_SERVER_TOKEN: secret('BATCH_DATA_SERVER_TOKEN'),
    DEBOUNCE_API_KEY: secret('DEBOUNCE_API_KEY'),
  },
});
