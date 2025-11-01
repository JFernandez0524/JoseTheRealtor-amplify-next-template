import { AuthGetCurrentUserServer } from '@/app/src/utils/amplifyServerUtils.server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      window.location.href = '/login';
      return <div>Not authorized</div>;
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    return <div>Error fetching user</div>;
  }
  return <section>{children}</section>;
}
