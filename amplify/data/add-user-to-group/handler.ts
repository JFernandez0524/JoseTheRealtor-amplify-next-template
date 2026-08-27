// amplify/data/add-user-to-group/handler.ts
import type { Schema } from '../resource';
import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

type Handler = Schema['addUserToGroup']['functionHandler'];

const cognitoClient = new CognitoIdentityProviderClient({});

async function resolveUsername(userPoolId: string, inputUserId: string): Promise<string> {
  let target = inputUserId.trim();
  if (target.includes('::')) {
    target = target.split('::')[1] || target.split('::')[0];
  }

  if (target.includes('@')) {
    try {
      const listRes = await cognitoClient.send(
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

  const targetUsername = await resolveUsername(userPoolId, userId);

  const command = new AdminAddUserToGroupCommand({
    Username: targetUsername,
    GroupName: groupName,
    UserPoolId: userPoolId,
  });

  try {
    const response = await cognitoClient.send(command);
    console.log(`✅ Successfully added ${targetUsername} to group ${groupName}`);
    return response;
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      try {
        const listRes = await cognitoClient.send(
          new ListUsersCommand({
            UserPoolId: userPoolId,
            Filter: `sub = "${targetUsername}"`,
            Limit: 1,
          })
        );
        if (listRes.Users && listRes.Users.length > 0 && listRes.Users[0].Username) {
          const fallbackUsername = listRes.Users[0].Username;
          const retryCommand = new AdminAddUserToGroupCommand({
            Username: fallbackUsername,
            GroupName: groupName,
            UserPoolId: userPoolId,
          });
          const retryRes = await cognitoClient.send(retryCommand);
          console.log(`✅ Successfully added ${fallbackUsername} to group ${groupName} via sub fallback`);
          return retryRes;
        }
      } catch (lookupErr) {
        console.warn('Sub lookup failed:', lookupErr);
      }
    }
    console.error('❌ Failed to add user to group:', error.message);
    throw error;
  }
};

