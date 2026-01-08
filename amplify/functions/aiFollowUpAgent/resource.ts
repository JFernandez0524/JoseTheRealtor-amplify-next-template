import { defineFunction } from '@aws-amplify/backend';

export const aiFollowUpAgent = defineFunction({
  name: 'aiFollowUpAgent',
  entry: './handler.ts',
  environment: {
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    BEDROCK_REGION: 'us-east-1'
  },
  timeoutSeconds: 300, // 5 minutes for processing multiple leads
});
