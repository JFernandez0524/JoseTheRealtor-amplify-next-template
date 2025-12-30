import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // 1. Assign 'FREE' group
  const command = new AdminAddUserToGroupCommand({
    GroupName: 'FREE',
    Username: event.userName,
    UserPoolId: event.userPoolId,
  });

  try {
    await client.send(command);
  } catch (error) {
    console.error('Group assignment error:', error);
  }

  return event; // Return event so Cognito proceeds
};
