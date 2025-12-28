import type { Schema } from '../resource';
import { env } from '$amplify/env/addUserToGroup';
import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

type Handler = Schema['addUserToGroup']['functionHandler'];

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Handler = async (event) => {
  const { userId, groupName } = event.arguments;

  if (!userId || !groupName) {
    throw new Error('Missing userId or groupName.');
  }

  const command = new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: groupName,
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
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
