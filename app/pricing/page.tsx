// app/pricing/page.tsx
import {
  AuthGetCurrentUserServer,
  AuthGetUserGroupsServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import PricingClient from '../components/pricing/PricingClient';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  // 1. Fetch User Identity & Groups on the Server
  const user = await AuthGetCurrentUserServer();
  const groups = await AuthGetUserGroupsServer();

  // 2. Fetch User Account Data on the Server
  let userAccount = null;
  if (user) {
    const { data: accounts } = await cookiesClient.models.UserAccount.list();
    if (accounts && accounts[0]) {
      userAccount = accounts[0];
    }
  }

  // 3. Derived Access States
  const hasPaidPlan = groups.includes('PRO') || groups.includes('AI_PLAN');
  const isAI = groups.includes('AI_PLAN');

  return (
    <PricingClient
      initialUserAccount={userAccount}
      hasPaidPlan={hasPaidPlan}
      isAI={isAI}
      userId={user?.userId || null}
    />
  );
}
