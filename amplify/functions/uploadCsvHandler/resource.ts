import { defineFunction, secret } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  environment: {
    BATCH_DATA_SERVER_TOKEN: secret('BATCH_DATA_SERVER_TOKEN'),
    // KVCORE_API_KEY: process.env.KVCORE_API_KEY!,
    // GOHIGHLEVEL_API_KEY: process.env.GOHIGHLEVEL_API_KEY!,
    // NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL!,
    // AUDIT_LOG_BUCKET: process.env.AUDIT_LOG_BUCKET!,
  },
});
