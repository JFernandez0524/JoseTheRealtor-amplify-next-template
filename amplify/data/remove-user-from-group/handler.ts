import type { Schema } from '../resource';
import {
  CognitoIdentityProviderClient,
  AdminRemoveUserFromGroupCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
type Handler = Schema['removeUserFromGroup']['functionHandler'];

async function resolveUsername(userPoolId: string, inputUserId: string): Promise<string> {
  let target = inputUserId.trim();
  if (target.includes('::')) {
    target = target.split('::')[1] || target.split('::')[0];
  }

  if (target.includes('@')) {
    try {
      const listRes = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${target}"`,
          Limit: 1,
        })
      );
      if (listRes.Users && listRes.Users.length > 0 && listRes.Users[0].Username) {
        return listRes.Users[0].Username;
      }
    } catch (e) {
      console.warn('Failed lookup by email:', e);
    }
  }

  return target;
}

export const handler: Handler = async (event) => {
  const { userId, groupName } = event.arguments;
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  if (!userPoolId) {
    throw new Error('AMPLIFY_AUTH_USERPOOL_ID environment variable is not set');
  }

  const targetUsername = await resolveUsername(userPoolId, userId);

  try {
    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: userPoolId,
      Username: targetUsername,
      GroupName: groupName,
    });
    await client.send(command);
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      try {
        const listRes = await client.send(
          new ListUsersCommand({
            UserPoolId: userPoolId,
            Filter: `sub = "${targetUsername}"`,
            Limit: 1,
          })
        );
        if (listRes.Users && listRes.Users.length > 0 && listRes.Users[0].Username) {
          const fallbackUsername = listRes.Users[0].Username;
          const retryCommand = new AdminRemoveUserFromGroupCommand({
            UserPoolId: userPoolId,
            Username: fallbackUsername,
            GroupName: groupName,
          });
          await client.send(retryCommand);
        }
      } catch (lookupErr) {
        console.warn('Sub lookup failed:', lookupErr);
      }
    } else if (error.name === 'ResourceNotFoundException') {
      // User might not have been in this group - safe to ignore
      console.warn(`User ${targetUsername} was not in group ${groupName}`);
    } else {
      throw error;
    }
  }

  return {
    success: true,
    message: `User ${targetUsername} removed from group ${groupName}`,
  };
};

