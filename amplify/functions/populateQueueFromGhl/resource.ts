import { defineFunction } from '@aws-amplify/backend';

export const populateQueueFromGhl = defineFunction({
  name: 'populateQueueFromGhl',
  timeoutSeconds: 900, // 15 minutes for large contact lists
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
});
