import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'leadFiles',
  access: (allow) => ({
    'leadFiles/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
