// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource';
import { skipTraceLeads } from './functions/skiptraceLeads/resource';
import { manualGhlSync } from './functions/manualGhlSync/resource';
import { addUserToGroup } from './data/add-user-to-group/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

const backend = defineBackend({
  auth,
  data,
  storage,
  uploadCsvHandler,
  skipTraceLeads,
  manualGhlSync,
  addUserToGroup,
});

// ============================================
// YOUR ORIGINAL CODE BELOW (UNCHANGED)
// ============================================
backend.storage.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  {
    prefix: 'leadFiles/',
  }
);
