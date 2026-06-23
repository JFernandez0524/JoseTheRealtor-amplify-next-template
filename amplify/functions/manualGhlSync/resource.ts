import { defineFunction, secret } from '@aws-amplify/backend';

// Define the name of the Lambda function resource.
export const manualGhlSync = defineFunction({
  // The function handler code will live in './handler.ts' or './index.ts'
  // and is the code we wrote in the previous step.
  name: 'manualGhlSync',
  entry: './handler.ts',
  // 💡 Configuration Notes:
  // 1. Setting a longer timeout is good practice for external API calls (like GHL).
  timeoutSeconds: 30, // 30 seconds should be safe for external API calls
  resourceGroupName: 'data',
  // 2. OAuth tokens are now managed via DynamoDB - no hardcoded secrets needed
  environment: {
    DEBOUNCE_API_KEY: secret('DEBOUNCE_API_KEY'),
  },

  // 3. (Optional but Recommended) Increase memory if the GHL sync involves heavy data processing
  // memoryMB: 256, // Default is 512 MB, which is usually fine.
});
