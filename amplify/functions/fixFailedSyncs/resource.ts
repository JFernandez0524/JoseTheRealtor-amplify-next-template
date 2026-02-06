import { defineFunction } from '@aws-amplify/backend';

export const fixFailedSyncs = defineFunction({
  name: 'fixFailedSyncs',
  timeoutSeconds: 900, // 15 minutes for large batches
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
});
