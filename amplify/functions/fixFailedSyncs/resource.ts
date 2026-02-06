import { defineFunction } from '@aws-amplify/backend';

export const fixFailedSyncs = defineFunction({
  name: 'fixFailedSyncs',
  timeoutSeconds: 900, // 15 minutes for large batches
  schedule: 'cron(0 6 * * ? *)', // Run daily at 6 AM UTC (1 AM EST)
});
