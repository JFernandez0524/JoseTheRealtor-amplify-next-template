import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource.js';
import { testFunction } from './functions/testFunction/resource.js';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { PolicyStatement, Effect, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

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
// Tell S3 to trigger 'uploadCsvHandler' when a file is uploaded
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.uploadCsvHandler.resources.lambda),
  {
    prefix: 'leadFiles/', // Only trigger for user files
  }
);

// --- 3. ENVIRONMENT VARIABLES ---
// Give the function the Table Name and Google API Key
backend.uploadCsvHandler.addEnvironment(
  'AMPLIFY_DATA_LEAD_TABLE_NAME',
  leadTable.tableName
);
// Ensure this matches the name in your .env file or Parameter Store
backend.uploadCsvHandler.addEnvironment(
  'GOOGLE_MAPS_API_KEY',
  process.env.GOOGLE_MAPS_API_KEY || ''
);

// --- 4. Permissions (UPDATED) ---

// Fix 1: Allow Listing the Bucket (Solves your AccessDenied error)
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      's3:ListBucket',
      's3:GetObject',
      's3:HeadObject', // 👈 ADD THIS - Your code uses HeadObjectCommand
      's3:GetObjectAttributes', // 👈 ADD THIS for good measure
    ],
    resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`], // 👈 Note: No "/*" at the end
  })
);

// Fix 3: Allow Writing to DynamoDB (Existing)
backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'dynamodb:PutItem',
      'dynamodb:BatchWriteItem',
      'dynamodb:Query',
      'dynamodb:GetItem',
    ],
    resources: [leadTable.tableArn],
  })
);

backend.uploadCsvHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.uploadCsvHandler.resources.lambda.functionArn],
    principals: [new ServicePrincipal('s3.amazonaws.com')],
  })
);
