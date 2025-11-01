import { NextRequest, NextResponse } from 'next/server';
import {
  runWithAmplifyServerContext,
  cookiesClient,
} from '@/app/src/utils/amplifyServerUtils.server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import { processCsvFile } from '@/app/src/lib/processCsv';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Authenticate user
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (ctx) => fetchAuthSession(ctx),
    });

    const userSub = session?.tokens?.idToken?.payload?.sub;
    if (!userSub) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    const client = cookiesClient;

    // 2️⃣ Handle CSV upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 });
      }

      const { validLeads, rejected, leadType } = await processCsvFile(
        file,
        userSub
      );

      for (const lead of validLeads) {
        await client.models.Lead.create(lead);
      }

      return NextResponse.json({
        message: `✅ Processed ${validLeads.length} ${leadType} leads`,
        stored: validLeads.length,
        rejected: rejected.length,
      });
    }

    // 3️⃣ Handle manual JSON lead
    if (contentType.includes('application/json')) {
      const data = await req.json();

      const {
        type,
        address,
        city,
        state,
        zip,
        firstName,
        lastName,
        executorFirstName,
        executorLastName,
        mailingAddress,
        mailingCity,
        mailingState,
        mailingZip,
        borrowerFirstName,
        borrowerLastName,
        caseNumber,
      } = data;

      // ✅ Validate required fields
      const required = { type, address, city, state, zip };
      const missing = Object.entries(required)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Missing required fields: ${missing.join(', ')}` },
          { status: 400 }
        );
      }

      // ✅ Build Lead object according to model
      const newLead: any = {
        type,
        address,
        city,
        state,
        zip,
        firstName: firstName || '',
        lastName: lastName || '',
        createdAt: new Date().toISOString(),
        userSub,
        standardizedAddress: null,
      };

      // Conditional fields for probate
      if (type === 'probate') {
        Object.assign(newLead, {
          executorFirstName: executorFirstName || '',
          executorLastName: executorLastName || '',
          mailingAddress: mailingAddress || '',
          mailingCity: mailingCity || '',
          mailingState: mailingState || '',
          mailingZip: mailingZip || '',
        });
      }

      // Conditional fields for preforeclosure
      if (type === 'preforeclosure') {
        Object.assign(newLead, {
          borrowerFirstName: borrowerFirstName || '',
          borrowerLastName: borrowerLastName || '',
          caseNumber: caseNumber || '',
        });
      }

      const savedLead = await client.models.Lead.create(newLead);

      return NextResponse.json({
        message: '✅ Lead added successfully',
        lead: savedLead,
      });
    }

    // 4️⃣ Invalid content type
    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Lead upload error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
