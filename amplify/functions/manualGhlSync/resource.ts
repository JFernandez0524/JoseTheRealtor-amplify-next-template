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
  // 2. Define the required environment variables (secrets are preferred for keys).
  environment: {
    // 💥 The GHL_API_KEY is a sensitive secret and should be managed securely.
    // Amplify will look up this secret at deployment time.
    GHL_API_KEY: secret('GHL_API_KEY'),

    // You may also need the table name, which Amplify usually injects automatically.
    // However, if your 'lead.server.ts' needs an explicit reference, you can add it here.
    // For now, we rely on the utility file handling the database connection setup.
  },

  // 3. (Optional but Recommended) Increase memory if the GHL sync involves heavy data processing
  // memoryMB: 256, // Default is 512 MB, which is usually fine.
});
