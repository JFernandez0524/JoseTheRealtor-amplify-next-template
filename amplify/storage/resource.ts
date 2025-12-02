import { defineStorage, defineFunction } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'leadFiles',
  access: (allow) => ({
    'leadFiles/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),

  triggers: {
    onUpload: defineFunction({
      entry: './on-upload-handler.ts',
    }),
    onDelete: defineFunction({
      entry: './on-delete-handler.ts',
    }),
  },
});
