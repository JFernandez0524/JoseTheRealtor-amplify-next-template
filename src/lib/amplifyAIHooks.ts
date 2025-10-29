import { generateClient } from 'aws-amplify/data';
import { createAIHooks } from '@aws-amplify/ui-react-ai';
import { type Schema } from '../../amplify/data/resource';

// 2. Generate an authenticated data client.
//    authMode: 'userPool' means "use the signed-in Cognito user".
export const client = generateClient<Schema>({
  authMode: 'userPool',
});

// 3. (optional) Hooks for the premade <AIConversation /> component
export const { useAIConversation, useAIGeneration } = createAIHooks(client);
