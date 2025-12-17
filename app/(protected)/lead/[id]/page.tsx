import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { LeadDetailClient } from '../../../components/leadDetails/LeadDetailClient';
import { Suspense } from 'react';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const { data: lead } = await cookiesClient.models.PropertyLead.get({ id });
    return {
      title: lead?.ownerAddress
        ? `${lead.ownerAddress} | Lead Detail`
        : 'Lead Detail',
      description: lead
        ? `Viewing lead details for ${lead.ownerAddress}`
        : 'Manage property lead details.',
    };
  } catch (error) {
    return { title: 'Lead Detail' };
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;

  // 1. Server-side fetch
  const { data: leadData, errors } =
    await cookiesClient.models.PropertyLead.get({
      id: id,
    });

  if (errors || !leadData) {
    redirect('/dashboard');
  }

  // 2. Sanitize to strip out DataProxy functions (contacts, enrichments, etc.)
  const sanitizedLead = JSON.parse(JSON.stringify(leadData));

  // 3. Render
  // Note: We use a standard div fallback here.
  // The real "Amplify Loader" should live in your app/(protected)/layout.tsx
  // wrapped in a 'use client' LoadingOverlay component.
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <p>Loading...</p>
        </div>
      }
    >
      <LeadDetailClient initialLead={sanitizedLead} />
    </Suspense>
  );
}
