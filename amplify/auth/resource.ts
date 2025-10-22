// amplify/auth/resource.ts
import { defineAuth, secret } from '@aws-amplify/backend';

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
        },
      },
      callbackUrls: [
        'http://localhost:3000/',
        'http://localhost:3000/auth',
        'http://localhost:3000/profile',
        'https://main.d127hbsjypuuhr.amplifyapp.com/profile',
        'https://main.d127hbsjypuuhr.amplifyapp.com/auth',
        'https://main.d127hbsjypuuhr.amplifyapp.com/',
        'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com/',
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'https://main.d127hbsjypuuhr.amplifyapp.com/',
        'https://main.d127hbsjypuuhr.amplifyapp.com/auth/',
        'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com',
        'https://1bfcf095620e088da6cd.auth.us-east-1.amazoncognito.com/auth',
      ],
    },
  },
});
