import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '../../../../src/utils/amplifyServerUtils.server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import { processCsvFile } from '../../../../src/lib/processCsv';
import { cookiesClient } from '@/src/utils/amplifyServerUtils.server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Get authenticated user from SSR cookies
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (ctx) => fetchAuthSession(ctx),
    });

    if (!session?.tokens?.idToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userSub = session.tokens.idToken.payload.sub;

    if (!userSub) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2️⃣ Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // 3️⃣ Process CSV (already implemented)
    const { validLeads, rejected, leadType } = await processCsvFile(
      file,
      userSub
    );

    // 4️⃣ Save to Amplify Data

    const client = cookiesClient;
    for (const lead of validLeads) {
      await client.models.Lead.create(lead);
    }

    return NextResponse.json({
      message: `Processed ${validLeads.length} ${leadType} leads`,
      stored: validLeads.length,
      rejected: rejected.length,
      preview: validLeads.slice(0, 5),
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
