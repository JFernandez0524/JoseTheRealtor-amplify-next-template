import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../amplify/data/resource';
import { createAIHooks } from '@aws-amplify/ui-react-ai';
import { Amplify } from 'aws-amplify';
import outputs from '../../../../amplify_outputs.json';

// Ensure Amplify is configured before creating client
if (typeof window !== 'undefined') {
  Amplify.configure(outputs, { ssr: true });
}

// 2. Create the Front End API client
export const client = generateClient<Schema>({ authMode: 'userPool' });

//Ai Hooks
export const { useAIConversation, useAIGeneration } = createAIHooks(client);
