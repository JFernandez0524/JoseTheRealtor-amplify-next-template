import { NextResponse } from 'next/server';
import {
  skipTraceProbateSingleLead,
  type LeadToSkip,
} from '@/app/utils/batchData.server'; // Check this path matches your project structure

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Note: The frontend sends 'address', 'city' etc. mapped from the Admin's info
    const { address, city, state, zip, firstName, lastName } = body;

    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, error: 'Missing required address fields' },
        { status: 400 }
      );
    }

    const leadToSkip: LeadToSkip = {
      propertyAddress: {
        street: address,
        city,
        state,
        zip,
      },
      name:
        firstName && lastName
          ? {
              first: firstName,
              last: lastName,
            }
          : undefined,
    };

    // Call the Probate specific wrapper
    const result = await skipTraceProbateSingleLead(leadToSkip);

    if (!result || !result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || 'Skip trace failed at provider.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
