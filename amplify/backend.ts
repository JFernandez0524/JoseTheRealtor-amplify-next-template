import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource';
import { skipTraceLeads } from './functions/skiptraceLeads/resource';
import { manualGhlSync } from './functions/manualGhlSync/resource';
import { addUserToGroup } from './data/add-user-to-group/resource'; // verify this path matches your folder
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

backend.storage.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  {
    prefix: 'leadFiles/',
  }
);

// const leadTable = backend.data.resources.tables['PropertyLead'];
// const userAccountTable = backend.data.resources.tables['UserAccount'];

// 1. Explicitly grant DynamoDB access line-by-line
// This is safer than a loop for breaking circularity
// const fns = [
//   backend.uploadCsvHandler,
//   backend.skipTraceLeads,
//   backend.manualGhlSync,
//   backend.addUserToGroup,
// ];

// fns.forEach((fn) => {
//   leadTable.grantReadWriteData(fn.resources.lambda);
//   userAccountTable.grantReadWriteData(fn.resources.lambda);
// });

// 3. S3 Link (Commented out for the first run)
// backend.storage.resources.bucket.grantReadWrite(backend.uploadCsvHandler.resources.lambda);

// 🛡️ RE-ENABLE THIS NOW:
// const storageBucket = backend.storage.resources.bucket;
// const csvLambda = backend.uploadCsvHandler.resources.lambda;

// storageBucket.grantReadWrite(csvLambda);

// import { EventType } from 'aws-cdk-lib/aws-s3';
// import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

// storageBucket.addEventNotification(
//   EventType.OBJECT_CREATED_PUT,
//   new LambdaDestination(csvLambda),
//   { prefix: 'leadFiles/' }
// );
