// amplify/data/add-user-to-group/handler.ts
import type { Schema } from '../resource';
import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

type Handler = Schema['addUserToGroup']['functionHandler'];

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Handler = async (event) => {
  const { userId, groupName } = event.arguments;

  const callerGroups: string[] =
    (event.identity as any)?.claims?.['cognito:groups'] ?? [];
  const callerIsAdmin = callerGroups.includes('ADMINS');

  if (!callerIsAdmin && groupName !== 'FREE') {
    throw new Error('Only ADMINS can assign groups other than FREE');
  }

  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  if (!userPoolId) {
    throw new Error('AMPLIFY_AUTH_USERPOOL_ID environment variable is not set');
  }

  const command = new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: groupName,
    UserPoolId: userPoolId,
  });

  try {
    const response = await cognitoClient.send(command);
    console.log(`✅ Successfully added ${userId} to group ${groupName}`);
    return response;
  } catch (error: any) {
    console.error('❌ Failed to add user to group:', error.message);
    throw error;
  }
};
