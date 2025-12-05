import { defineStorage } from '@aws-amplify/backend';
import { uploadCsvHandler } from '../functions/uploadCsvHandler/resource';

export const storage = defineStorage({
  name: 'leadFiles',
  access: (allow) => ({
    'leadFiles/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.resource(uploadCsvHandler).to(['read', 'write', 'delete']),
    ],
  }),
});
