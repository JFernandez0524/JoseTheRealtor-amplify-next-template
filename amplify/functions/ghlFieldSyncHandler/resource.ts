import { defineFunction } from '@aws-amplify/backend';

export const ghlFieldSyncHandler = defineFunction({
  name: 'ghlFieldSyncHandler',
  timeoutSeconds: 30,
});
