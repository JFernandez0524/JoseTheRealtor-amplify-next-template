import { defineFunction } from '@aws-amplify/backend';

export const thanksIoWebhookHandler = defineFunction({
  name: 'thanksIoWebhookHandler',
  timeoutSeconds: 30,
});
