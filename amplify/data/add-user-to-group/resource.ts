// amplify/data/add-user-to-group/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const addUserToGroup = defineFunction({
  name: 'addUserToGroup',
  entry: './handler.ts',
  resourceGroupName: 'auth',
});
