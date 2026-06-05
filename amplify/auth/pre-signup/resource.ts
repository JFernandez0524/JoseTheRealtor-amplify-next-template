import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-signup',
  resourceGroupName: 'auth',
});
