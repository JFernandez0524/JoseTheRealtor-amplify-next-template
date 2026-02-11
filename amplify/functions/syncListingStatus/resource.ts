import { defineFunction } from '@aws-amplify/backend';

export const syncListingStatus = defineFunction({
  name: 'syncListingStatus',
  timeoutSeconds: 900, // 15 minutes for large datasets
  resourceGroupName: 'data', // Assign to data stack
});
