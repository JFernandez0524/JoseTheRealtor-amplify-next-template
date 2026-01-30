import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../amplify/data/resource';
import { createAIHooks } from '@aws-amplify/ui-react-ai';

// 2. Create the Front End API client
export const client = generateClient<Schema>({ authMode: 'userPool' });

//Ai Hooks
export const { useAIConversation, useAIGeneration } = createAIHooks(client);
