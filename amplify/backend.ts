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

// 🚀 S3 Trigger - uploadCsvHandler is in storage stack (no cross-stack reference)
backend.storage.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  { prefix: 'leadFiles/' }
);

// 🛡️ Grant S3 read and delete permissions to uploadCsvHandler (same stack, no circular dependency)
backend.storage.resources.bucket.grantReadWrite(backend.uploadCsvHandler.resources.lambda);

// 🛡️ Grant uploadCsvHandler access to data resources (cross-stack but necessary)
backend.data.resources.tables['PropertyLead'].grantReadWriteData(
  backend.uploadCsvHandler.resources.lambda
);
backend.data.resources.tables['UserAccount'].grantReadWriteData(
  backend.uploadCsvHandler.resources.lambda
);

// 🛡️ Add table name environment variables
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
  backend.data.resources.tables['PropertyLead'].tableName
);
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_UserAccount_TABLE_NAME',
  backend.data.resources.tables['UserAccount'].tableName
);

// 🛡️ Add table name environment variables to data stack functions
backend.skipTraceLeads.addEnvironment(
  'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
  backend.data.resources.tables['PropertyLead'].tableName
);
backend.skipTraceLeads.addEnvironment(
  'AMPLIFY_DATA_UserAccount_TABLE_NAME',
  backend.data.resources.tables['UserAccount'].tableName
);

backend.manualGhlSync.addEnvironment(
  'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
  backend.data.resources.tables['PropertyLead'].tableName
);
backend.manualGhlSync.addEnvironment(
  'AMPLIFY_DATA_UserAccount_TABLE_NAME',
  backend.data.resources.tables['UserAccount'].tableName
);

// 🛡️ Grant DynamoDB permissions to data stack functions
backend.data.resources.tables['PropertyLead'].grantReadWriteData(
  backend.skipTraceLeads.resources.lambda
);
backend.data.resources.tables['UserAccount'].grantReadWriteData(
  backend.skipTraceLeads.resources.lambda
);
backend.data.resources.tables['PropertyLead'].grantReadWriteData(
  backend.manualGhlSync.resources.lambda
);
backend.data.resources.tables['UserAccount'].grantReadWriteData(
  backend.manualGhlSync.resources.lambda
);

// 🛡️ Auth Permissions for uploadCsvHandler
backend.auth.resources.userPool.grant(
  backend.uploadCsvHandler.resources.lambda,
  'cognito-idp:AdminAddUserToGroup',
  'cognito-idp:AdminGetUser'
);
