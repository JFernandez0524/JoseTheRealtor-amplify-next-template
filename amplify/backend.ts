import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { uploadCsvHandler } from './functions/uploadCsvHandler/resource';
import { skipTraceLeads } from './functions/skiptraceLeads/resource';
import { manualGhlSync } from './functions/manualGhlSync/resource';
import { aiFollowUpAgent } from './functions/aiFollowUpAgent/resource';
import { dailyOutreachAgent } from './functions/dailyOutreachAgent/resource';
import { dailyEmailAgent } from './functions/dailyEmailAgent/resource';
import { bulkEmailCampaign } from './functions/bulkEmailCampaign/resource';
import { inboundMessagePoller } from './functions/inboundMessagePoller/resource';
import { addUserToGroup } from './data/add-user-to-group/resource';
import { removeUserFromGroup } from './data/remove-user-from-group/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const backend = defineBackend({
  auth,
  data,
  storage,
  uploadCsvHandler,
  skipTraceLeads,
  manualGhlSync,
  aiFollowUpAgent,
  dailyOutreachAgent,
  dailyEmailAgent,
  bulkEmailCampaign,
  inboundMessagePoller,
  addUserToGroup,
  removeUserFromGroup,
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
backend.manualGhlSync.addEnvironment(
  'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
);
backend.manualGhlSync.addEnvironment(
  'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
  backend.data.resources.tables['OutreachQueue'].tableName
);
backend.manualGhlSync.addEnvironment('GHL_CLIENT_ID', process.env.GHL_CLIENT_ID || '');
backend.manualGhlSync.addEnvironment('GHL_CLIENT_SECRET', process.env.GHL_CLIENT_SECRET || '');

// 🤖 Add AI Follow-Up Agent environment variables
backend.aiFollowUpAgent.addEnvironment(
  'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
  backend.data.resources.tables['PropertyLead'].tableName
);
backend.aiFollowUpAgent.addEnvironment(
  'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
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
backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.manualGhlSync.resources.lambda
);
backend.data.resources.tables['OutreachQueue'].grantReadWriteData(
  backend.manualGhlSync.resources.lambda
);

// 🤖 Grant DynamoDB permissions to AI Follow-Up Agent
backend.data.resources.tables['PropertyLead'].grantReadWriteData(
  backend.aiFollowUpAgent.resources.lambda
);
backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.aiFollowUpAgent.resources.lambda
);

// 🛡️ Auth Permissions for uploadCsvHandler
backend.auth.resources.userPool.grant(
  backend.uploadCsvHandler.resources.lambda,
  'cognito-idp:AdminAddUserToGroup',
  'cognito-idp:AdminGetUser'
);

// 🛡️ Auth Permissions for removeUserFromGroup
backend.auth.resources.userPool.grant(
  backend.removeUserFromGroup.resources.lambda,
  'cognito-idp:AdminRemoveUserFromGroup'
);

// 🤖 Grant Bedrock permissions to AI Follow-Up Agent
backend.aiFollowUpAgent.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0']
  })
);

// 📤 Configure Daily Outreach Agent
backend.dailyOutreachAgent.addEnvironment(
  'GHL_INTEGRATION_TABLE',
  backend.data.resources.tables['GhlIntegration'].tableName
);

backend.dailyOutreachAgent.addEnvironment(
  'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
);

backend.dailyOutreachAgent.addEnvironment(
  'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
  backend.data.resources.tables['OutreachQueue'].tableName
);

backend.dailyOutreachAgent.addEnvironment('GHL_CLIENT_ID', process.env.GHL_CLIENT_ID || '');
backend.dailyOutreachAgent.addEnvironment('GHL_CLIENT_SECRET', process.env.GHL_CLIENT_SECRET || '');
backend.dailyOutreachAgent.addEnvironment('API_ENDPOINT', process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com');

backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.dailyOutreachAgent.resources.lambda
);

backend.data.resources.tables['OutreachQueue'].grantReadWriteData(
  backend.dailyOutreachAgent.resources.lambda
);

// 📧 Configure Bulk Email Campaign
backend.bulkEmailCampaign.addEnvironment(
  'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
);

backend.bulkEmailCampaign.addEnvironment('GHL_CLIENT_ID', process.env.GHL_CLIENT_ID || '');
backend.bulkEmailCampaign.addEnvironment('GHL_CLIENT_SECRET', process.env.GHL_CLIENT_SECRET || '');

backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.bulkEmailCampaign.resources.lambda
);

// 📧 Configure Daily Email Agent
backend.dailyEmailAgent.addEnvironment(
  'GHL_INTEGRATION_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
);

backend.dailyEmailAgent.addEnvironment(
  'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
  backend.data.resources.tables['OutreachQueue'].tableName
);

backend.dailyEmailAgent.addEnvironment('APP_URL', process.env.APP_URL || 'https://leads.josetherealtor.com');

backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.dailyEmailAgent.resources.lambda
);

backend.data.resources.tables['OutreachQueue'].grantReadWriteData(
  backend.dailyEmailAgent.resources.lambda
);


// 📬 Configure Inbound Message Poller (runs every 10 minutes)
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const pollerRule = new Rule(backend.inboundMessagePoller.resources.lambda.stack, 'InboundPollerSchedule', {
  schedule: Schedule.rate({ minutes: 10 })
});

pollerRule.addTarget(new LambdaFunction(backend.inboundMessagePoller.resources.lambda));

backend.inboundMessagePoller.addEnvironment(
  'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
  backend.data.resources.tables['GhlIntegration'].tableName
);

backend.inboundMessagePoller.addEnvironment('GHL_CLIENT_ID', process.env.GHL_CLIENT_ID || '');
backend.inboundMessagePoller.addEnvironment('GHL_CLIENT_SECRET', process.env.GHL_CLIENT_SECRET || '');
backend.inboundMessagePoller.addEnvironment('API_ENDPOINT', process.env.API_ENDPOINT || 'https://leads.JoseTheRealtor.com');

backend.data.resources.tables['GhlIntegration'].grantReadData(
  backend.inboundMessagePoller.resources.lambda
);
