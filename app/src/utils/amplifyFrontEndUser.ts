import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';

export async function getFrontEndUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

export async function getFrontEndUserAttributes() {
  try {
    const attributes = await fetchUserAttributes();
    return attributes;
  } catch (error) {
    console.error('Error fetching user attributes:', error);
    return null;
  }
}
