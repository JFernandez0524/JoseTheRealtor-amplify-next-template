import { defineFunction } from '@aws-amplify/backend';

export const testFunction = defineFunction({
  name: 'testFunction',
  entry: './handler.ts',
});
