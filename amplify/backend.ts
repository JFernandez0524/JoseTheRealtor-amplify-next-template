import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';

defineBackend({
  auth,
  data,
  uploadCsvHandler,
});
