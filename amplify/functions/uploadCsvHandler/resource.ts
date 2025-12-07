import { defineFunction, secret } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  resourceGroupName: 'storage',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    BATCH_DATA_SERVER_TOKEN: secret('BATCH_DATA_SERVER_TOKEN'),
    KVCORE_API_KEY: secret('KVCORE_API_KEY'),
    GOHIGHLEVEL_API_KEY: secret('GOHIGHLEVEL_API_KEY'),
    GOOGLE_MAPS_API_KEY: secret('GOOGLE_MAPS_API_KEY'),
    // NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL!,
    // AUDIT_LOG_BUCKET: process.env.AUDIT_LOG_BUCKET!,
  },
});
