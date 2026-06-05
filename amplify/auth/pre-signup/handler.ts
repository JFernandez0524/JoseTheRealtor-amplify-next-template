import type { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PreSignUpTriggerHandler = async (event) => {
  const { userPoolId, request } = event;
  const email = request.userAttributes.email;
  const triggerSource = event.triggerSource;

  if (!email) return event;

  let existingUsers;
  try {
    const result = await client.send(
      new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${email}"` })
    );
    existingUsers = result.Users ?? [];
  } catch (err) {
    // Fail open — don't block signup if lookup fails
    console.error('PreSignUp ListUsers error:', err);
    return event;
  }

  if (existingUsers.length === 0) return event;

  const hasGoogleAccount = existingUsers.some(u => u.Username?.startsWith('google_'));
  const hasNativeAccount = existingUsers.some(u => !u.Username?.startsWith('google_'));

  if (triggerSource === 'PreSignUp_SignUp' && hasGoogleAccount) {
    throw new Error('An account with this email already exists. Please sign in with Google instead.');
  }

  if (triggerSource === 'PreSignUp_ExternalProvider' && hasNativeAccount) {
    throw new Error('An account with this email already exists. Please sign in with your email and password instead.');
  }

  return event;
};
