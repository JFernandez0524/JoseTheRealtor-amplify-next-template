import { defineFunction, secret } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  resourceGroupName: 'storage',
  timeoutSeconds: 61,
  memoryMB: 512,
  environment: {
    GOOGLE_MAPS_API_KEY: secret('GOOGLE_MAPS_API_KEY'),
    // NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL!,
    // AUDIT_LOG_BUCKET: process.env.AUDIT_LOG_BUCKET!,
  },
});
