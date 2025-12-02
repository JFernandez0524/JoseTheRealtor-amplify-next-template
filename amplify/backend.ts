import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { testFunction } from './functions/testFunction/resource.js';

defineBackend({
  auth,
  data,
  uploadCsvHandler,
  testFunction,
  storage,
});
