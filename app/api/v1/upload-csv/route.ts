import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '../../../../src/lib/amplifyClient.server';
import { processCsvFile } from '../../../../src/lib/processCsv';
import { parseJwt } from '../../../../src/lib/parserJwt'; // simple helper

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader)
      return NextResponse.json(
        { error: 'Missing auth token' },
        { status: 401 }
      );

    const token = authHeader.replace('Bearer ', '');
    const claims = parseJwt(token);
    if (!claims?.sub)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file)
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    // ✅ Use your new lib function
    const { validLeads, rejected, leadType } = await processCsvFile(
      file,
      claims.sub
    );

    // ✅ Save to Amplify Data
    const client = getServerClient();
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
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
