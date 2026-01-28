import { defineFunction, secret } from '@aws-amplify/backend';

export const uploadCsvHandler = defineFunction({
  name: 'uploadCsvHandler',
  entry: './handler.ts',
  timeoutSeconds: 900,
  resourceGroupName: 'storage',
  memoryMB: 512,
  environment: {
    GOOGLE_MAPS_API_KEY: secret('GOOGLE_MAPS_API_KEY'),
    BRIDGE_API_KEY: secret('BRIDGE_API_KEY'),
  },
});
