import { defineFunction } from '@aws-amplify/backend';

export const stripeWebhookHandler = defineFunction({
  name: 'stripeWebhookHandler',
  entry: './handler.ts',
  timeoutSeconds: 30,
});
