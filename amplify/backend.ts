import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  uploadCsvHandler,
  storage,
});

const leadTable = backend.data.resources.tables['PropertyLead'];
const storageBucket = backend.storage.resources.bucket;

// 1. S3 Trigger
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  { prefix: 'leadFiles/' }
);

// 2. Environment Variables
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName
);

// 3. Permissions
// S3: Added 's3:DeleteObject'
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:ListBucket', 's3:GetObject', 's3:DeleteObject'],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
  })
);

// DynamoDB: Added 'dynamodb:Query' and access to the Index
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:Query'],
    resources: [
      leadTable.tableArn,
      `${leadTable.tableArn}/index/*`, // 👈 Needed for the Secondary Index
    ],
  })
);
