import { defineStorage } from '@aws-amplify/backend';
// import { uploadCsvHandler } from '../functions/uploadCsvHandler/resource';

export const storage = defineStorage({
  name: 'leadFiles',
  access: (allow) => ({
    'leadFiles/{entity_id}/*': [
      // Grants the processor permission to manage files in this path
      // allow.resource(uploadCsvHandler).to(['read', 'write', 'delete']),
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['ADMINS']).to(['read', 'write', 'delete']),
    ],
  }),
});
