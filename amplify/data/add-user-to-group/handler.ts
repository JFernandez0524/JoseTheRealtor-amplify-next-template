import type { Schema } from '../resource';
import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider';

type Handler = Schema['addUserToGroup']['functionHandler'];

const client = new CognitoIdentityProviderClient({});

async function getUserPoolId(): Promise<string> {
  // Most apps have exactly one user pool in the account/region for the project.
  // Increase MaxResults if needed.
  const res = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const pool = res.UserPools?.[0];

  if (!pool?.Id) {
    throw new Error('No Cognito User Pool found in this account/region.');
  }
  return pool.Id;
}

export const handler: Handler = async (event) => {
  const { userId, groupName } = event.arguments;

  if (!userId || !groupName) {
    throw new Error('Missing userId or groupName.');
  }

  const userPoolId = await getUserPoolId();

  const command = new AdminAddUserToGroupCommand({
    Username: userId,
    GroupName: groupName,
    UserPoolId: userPoolId,
  });

  return await client.send(command);
};
