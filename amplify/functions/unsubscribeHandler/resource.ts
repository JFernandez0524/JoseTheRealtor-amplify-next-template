import { defineFunction } from '@aws-amplify/backend';

export const unsubscribeHandler = defineFunction({
  name: 'unsubscribeHandler',
  timeoutSeconds: 30,
});
