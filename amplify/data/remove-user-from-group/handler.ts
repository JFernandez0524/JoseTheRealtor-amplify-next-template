import type { Schema } from '../resource';
import {
  CognitoIdentityProviderClient,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
type Handler = Schema['removeUserFromGroup']['functionHandler'];

export const handler: Handler = async (event) => {
  const { userId, groupName } = event.arguments;

  const command = new AdminRemoveUserFromGroupCommand({
    UserPoolId: process.env.AMPLIFY_AUTH_USERPOOL_ID,
    Username: userId,
    GroupName: groupName,
  });

  await client.send(command);

  return {
    success: true,
    message: `User ${userId} removed from group ${groupName}`,
  };
};
