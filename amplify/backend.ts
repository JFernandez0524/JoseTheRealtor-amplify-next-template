// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { skipTraceLeads } from './functions/skiptraceLeads/resource.js';
import { manualGhlSync } from './functions/manualGhlSync/resource.js';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { addUserToGroup } from './data/add-user-to-group/resource.js';

const backend = defineBackend({
  auth,
  data,
  uploadCsvHandler,
  skipTraceLeads,
  manualGhlSync,
  storage,
  addUserToGroup,
});

const storageBucket = backend.storage.resources.bucket;
const leadTable = backend.data.resources.tables['PropertyLead'];
const userAccountTable = backend.data.resources.tables['UserAccount'];

backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:DeleteObject',
      's3:ListBucket',
    ],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
  })
);

// ============================================
// LAMBDA PERMISSIONS (NO CIRCULAR DEPENDENCY)
// ============================================

// Grant uploadCsvHandler access to S3
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:PutObject',
      's3:DeleteObject',
      's3:ListBucket',
    ],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
  })
);

// Grant all data functions access to DynamoDB
const dataFunctions = [
  backend.uploadCsvHandler,
  backend.skipTraceLeads,
  backend.manualGhlSync,
  // backend.addUserToGroup,
];

dataFunctions.forEach((fn) => {
  fn.addEnvironment('AMPLIFY_DATA_LEAD_TABLE_NAME', leadTable.tableName);
  fn.addEnvironment(
    'AMPLIFY_DATA_USER_ACCOUNT_TABLE_NAME',
    userAccountTable.tableName
  );

  fn.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:DeleteItem',
      ],
      resources: [
        leadTable.tableArn,
        `${leadTable.tableArn}/index/*`,
        userAccountTable.tableArn,
        `${userAccountTable.tableArn}/index/*`,
      ],
    })
  );
});

// ============================================
// S3 EVENT NOTIFICATION (OPTIONAL - UNCOMMENT WHEN READY)
// ============================================
// IMPORTANT: Only uncomment this after the initial deployment succeeds
// This creates an S3 trigger that invokes uploadCsvHandler when files are uploaded
/*
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

storageBucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  { prefix: 'leadFiles/' }
);
*/
