import { defineStorage } from '@aws-amplify/backend';
// import { uploadCsvHandler } from '../functions/uploadCsvHandler/resource';

export const storage = defineStorage({
  name: 'leadFiles',
  access: (allow) => ({
    'leadFiles/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['FREE', 'PRO', 'AI_PLAN', 'ADMINS']).to(['read', 'write', 'delete']),
    ],
  }),
});
