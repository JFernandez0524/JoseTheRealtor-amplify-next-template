import { NextResponse } from 'next/server';
import { skipTraceProbateSingleLead } from '@/app/utils/batchData.server';

export async function POST(request: Request) {
  try {
    // Note: The frontend sends the Admin's address here
    const { address, city, state, zip } = await request.json();

    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, error: 'Missing Executor/Admin address fields' },
        { status: 400 }
      );
    }

    // 1. Call your Utility Function
    const data = await skipTraceProbateSingleLead({
      propertyAddress: { street: address, city, state, zip },
    });

    const resultData = data?.result?.data?.[0];

    // 2. Handle Empty Results
    if (!resultData || !resultData.persons || resultData.persons.length === 0) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    // 3. Format Data for Frontend
    const contacts = resultData.persons.map((person: any, index: number) => ({
      id: `pb-${Date.now()}-${index}`,
      firstName: person.name?.first || 'Unknown',
      lastName: person.name?.last || '',
      phones:
        person.phones?.filter((p: any) => p.number).map((p: any) => p.number) ||
        [],
      emails:
        person.emails?.filter((e: any) => e.email).map((e: any) => e.email) ||
        [],
    }));

    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    console.error('Probate Route Error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
