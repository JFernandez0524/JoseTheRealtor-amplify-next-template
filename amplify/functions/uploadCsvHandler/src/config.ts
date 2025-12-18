// amplify/functions/uploadCsvHandler/src/config.ts

export const config = {
  batchdataApiKey: process.env.BATCH_DATA_SERVER_TOKEN || '',
  kvcoreApiKey: process.env.KVCORE_API_KEY || '',
  goHighLevelApiKey: process.env.GHL_API_KEY || '',
  notificationWebhook: process.env.NOTIFICATION_WEBHOOK_URL || '',
  auditBucket: process.env.AUDIT_LOG_BUCKET || '',
  ghlLocationId: process.env.GHL_LOCATION_ID!,
};
