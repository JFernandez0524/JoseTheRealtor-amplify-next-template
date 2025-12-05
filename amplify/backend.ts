import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { testFunction } from './functions/testFunction/resource.js';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  uploadCsvHandler,
  testFunction,
  storage,
});

// --- 1. CONFIGURATION ---
const leadTable = backend.data.resources.tables['Lead'];
const storageBucket = backend.storage.resources.bucket;

// --- 2. TRIGGER CONNECTION ---
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  {
    prefix: 'leadFiles/',
  }
);

// --- 3. ENVIRONMENT VARIABLES ---
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName
);
backend.uploadCsvHandler.addEnvironment(
  'GOOGLE_MAPS_API_KEY',
  process.env.GOOGLE_MAPS_API_KEY || ''
);

// --- 4. PERMISSIONS ---

// S3 Permissions - READ ONLY (removed principals)
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      's3:ListBucket',
      's3:GetObject',
      's3:HeadObject',
      's3:GetObjectAttributes',
    ],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
  })
);

// DynamoDB Permissions - WRITE
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'dynamodb:PutItem',
      'dynamodb:BatchWriteItem',
      'dynamodb:Query',
      'dynamodb:GetItem',
    ],
    resources: [leadTable.tableArn],
  })
);
