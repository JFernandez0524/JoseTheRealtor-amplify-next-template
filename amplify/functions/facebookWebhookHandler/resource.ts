import { defineFunction } from '@aws-amplify/backend';

export const facebookWebhookHandler = defineFunction({
  name: 'facebookWebhookHandler',
  timeoutSeconds: 30,
});
