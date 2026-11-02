import { Amplify } from 'aws-amplify';
import outputs from '../../../../amplify_outputs.json';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../amplify/data/resource';
import { createAIHooks } from '@aws-amplify/ui-react-ai';

// 1. Ensure Amplify is configured before client and hooks initialization
Amplify.configure(outputs, { ssr: true });

// 2. Create the Front End API client
export const client = generateClient<Schema>({ authMode: 'userPool' });

//Ai Hooks
export const { useAIConversation, useAIGeneration } = createAIHooks(client);
