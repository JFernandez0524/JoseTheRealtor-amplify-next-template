import { defineFunction } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  timeoutSeconds: 900,
  resourceGroupName: 'storage',
  memoryMB: 512,
});
