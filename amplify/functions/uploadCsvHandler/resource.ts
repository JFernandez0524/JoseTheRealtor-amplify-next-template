import { defineFunction } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './src/index.ts',
  environment: {
    BATCHDATA_API_KEY: process.env.BATCH_DATA_SERVER_TOKEN!,
    KVCORE_API_KEY: process.env.KVCORE_API_KEY!,
    GOHIGHLEVEL_API_KEY: process.env.GOHIGHLEVEL_API_KEY!,
    NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL!,
    AUDIT_LOG_BUCKET: process.env.AUDIT_LOG_BUCKET!,
  },
});
