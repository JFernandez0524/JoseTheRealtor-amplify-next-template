import { defineFunction } from '@aws-amplify/backend';

export const inboundMessagePoller = defineFunction({
  name: 'inboundMessagePoller',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  schedule: 'every 10m'
});
