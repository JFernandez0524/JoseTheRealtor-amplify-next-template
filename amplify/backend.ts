import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { skipTraceLeads } from './functions/skiptraceLeads/resource.js';
import { manualGhlSync } from './functions/manualGhlSync/resource.js'; // 💥 1. NEW IMPORT
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  uploadCsvHandler,
  skipTraceLeads,
  manualGhlSync, // 💥 2. ADD NEW FUNCTION
  storage,
});

const leadTable = backend.data.resources.tables['PropertyLead'];
const storageBucket = backend.storage.resources.bucket;

// 1. S3 Trigger (Unchanged)
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  { prefix: 'leadFiles/' }
);

// 2. Environment Variables for uploadCsvHandler (Unchanged)
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName
);

// 🎯 This line resolves the bucket name and sets the environment variable
backend.uploadCsvHandler.addEnvironment(
  'LEAD_FILES_BUCKET_NAME',
  backend.storage.resources.bucket.bucketName
);

// 3. Environment Variables for skipTraceLeads (Unchanged - uses utility now)
backend.skipTraceLeads.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName // Though no longer used directly, keeping this for completeness if the utility still relies on it.
);

// 4. Permissions for uploadCsvHandler (Unchanged)
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    // Added s3:PutObject to allow metadata updates
    actions: [
      's3:ListBucket',
      's3:GetObject',
      's3:DeleteObject',
      's3:PutObject',
    ],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
  })
);

backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:Query'],
    resources: [leadTable.tableArn, `${leadTable.tableArn}/index/*`],
  })
);

// 5. Permissions for skipTraceLeads (Unchanged - uses utility now)
backend.skipTraceLeads.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
    resources: [leadTable.tableArn],
  })
);

// 💥 6. Permissions for manualGhlSync (NEW BLOCK)
// The function needs to READ the lead and UPDATE its status fields.
backend.manualGhlSync.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
    resources: [leadTable.tableArn],
  })
);

// 💥 7. Environment Variable for manualGhlSync (Optional, as the utility may handle it)
// Adding for clarity, matching the permissions setup.
backend.manualGhlSync.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName
);
