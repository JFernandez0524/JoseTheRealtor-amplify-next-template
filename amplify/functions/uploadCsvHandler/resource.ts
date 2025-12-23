import { defineFunction, secret } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 61,
  memoryMB: 512,
  environment: {
    GOOGLE_MAPS_API_KEY: secret('GOOGLE_MAPS_API_KEY'),
  },
});
