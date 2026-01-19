import { defineFunction } from '@aws-amplify/backend';

export const bulkEmailCampaign = defineFunction({
  name: 'bulkEmailCampaign',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for bulk processing
  memoryMB: 512,
});
