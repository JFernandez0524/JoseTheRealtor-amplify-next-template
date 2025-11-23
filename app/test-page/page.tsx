import { cookiesClient } from '../utils/aws/auth/amplifyServerUtils.server';

export default async function page() {
  const response = await cookiesClient.queries.testFunction({
    message: 'Hello World',
  });
  return <div>{JSON.stringify(response)}</div>;
}
