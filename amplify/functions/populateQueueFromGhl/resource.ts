import { defineFunction } from '@aws-amplify/backend';

export const populateQueueFromGhl = defineFunction({
  name: 'populateQueueFromGhl',
  timeoutSeconds: 900, // 15 minutes for large contact lists
});
