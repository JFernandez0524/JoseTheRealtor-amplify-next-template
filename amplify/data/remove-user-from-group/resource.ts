import { defineFunction } from '@aws-amplify/backend';

export const removeUserFromGroup = defineFunction({
  entry: './handler.ts',
  name: 'removeUserFromGroup',
  timeoutSeconds: 30,
});
