import { defineFunction } from '@aws-amplify/backend';

export const lexV2Handler = defineFunction({
  name: 'lexV2Handler',
  entry: './handler.ts',
  environment: {
    LEX_BOT_ID: 'your-bot-id',
    LEX_BOT_ALIAS_ID: 'TSTALIASID',
    LEX_LOCALE_ID: 'en_US'
  },
  runtime: 20
});
