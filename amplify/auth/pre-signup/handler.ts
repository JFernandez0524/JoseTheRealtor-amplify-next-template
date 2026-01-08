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

  // Only check for email signups (not Google OAuth)
  if (triggerSource === 'PreSignUp_SignUp' && email) {
    try {
      // Check if a user already exists with this email
      const listUsersCommand = new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${email}"`,
      });

      const existingUsers = await client.send(listUsersCommand);

      if (existingUsers.Users && existingUsers.Users.length > 0) {
        // Check if any existing user is a Google user
        const hasGoogleUser = existingUsers.Users.some(user => 
          user.Username?.startsWith('google_') || 
          user.Identities?.some(identity => identity.ProviderName === 'Google')
        );

        if (hasGoogleUser) {
          throw new Error('An account with this email already exists. Please sign in with Google instead.');
        }
      }
    } catch (error) {
      console.error('PreSignUp check error:', error);
      // Re-throw to prevent signup
      throw error;
    }
  }

  return event;
};
