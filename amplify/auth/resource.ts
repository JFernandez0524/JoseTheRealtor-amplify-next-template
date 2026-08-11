// amplify/auth/resource.ts
import { defineAuth, secret } from '@aws-amplify/backend';
import { addUserToGroup } from '../data/add-user-to-group/resource';
import { postConfirmation } from './post-confirmation/resource';
import { preSignUp } from './pre-signup/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['profile', 'email', 'openid', 'phone'],
        attributeMapping: {
          email: 'email',
          familyName: 'lastName',
          givenName: 'firstName',
          preferredUsername: 'username',
          nickname: 'nickname',
          profilePicture: 'picture',
          phoneNumber: 'phone_number',
          birthdate: 'birthdate',
          fullname: 'name',
          locale: 'locale',
          address: 'address',
          profilePage: 'profile',
        },
      },
      callbackUrls: [
        'https://dealfinder.yourailaunch.com/login',
        'https://dealfinder.yourailaunch.com/',
        'http://localhost:3000/login',
        'http://localhost:3000/',
      ],
      logoutUrls: [
        'https://dealfinder.yourailaunch.com/logout',
        'https://dealfinder.yourailaunch.com/login',
        'https://dealfinder.yourailaunch.com/',
        'http://localhost:3000/logout',
        'http://localhost:3000/login',
        'http://localhost:3000/',
      ],
    },
  },
  groups: ['ADMINS', 'PRO', 'AI_PLAN', 'FREE'],
  triggers: {
    preSignUp,
    postConfirmation,
  },
  access: (allow) => [
    allow.resource(addUserToGroup).to(['addUserToGroup']),
    allow.resource(postConfirmation).to(['addUserToGroup']),
    allow.resource(preSignUp).to(['listUsers']),
  ],
});
