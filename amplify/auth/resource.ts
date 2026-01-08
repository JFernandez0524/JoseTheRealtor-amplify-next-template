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
        clientId: secret('GOOGLE_CLIENT_ID'), // ✅ fixed
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
        // 'http://localhost:3000/',
        // 'http://localhost:3000/auth',
        // 'http://localhost:3000/profile',
        // 'https://main.d127hbsjypuuhr.amplifyapp.com/profile',
        // 'https://main.d127hbsjypuuhr.amplifyapp.com/auth',
        // 'https://main.d127hbsjypuuhr.amplifyapp.com/',
        // 'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com/'
        //
        'https://leads.josetherealtor.com/login',

        'http://localhost:3000/login',
      ],
      logoutUrls: [
        // 'http://localhost:3000/',
        // 'https://main.d127hbsjypuuhr.amplifyapp.com/',
        // 'https://main.d127hbsjypuuhr.amplifyapp.com/auth/',
        // 'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com',
        // 'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com/auth',
        'https://leads.josetherealtor.com/logout',
        'http://localhost:3000/logout',
      ],
    },
  },
  // Define your monetization and admin groups
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
