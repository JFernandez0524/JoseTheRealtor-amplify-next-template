import { NextResponse } from 'next/server';
import {
  skipTracePreForeClosureSingleLead,
  type LeadToSkip,
} from '@/app/utils/batchData.server'; // Check this path matches your project structure

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, city, state, zip, firstName, lastName } = body;

    // Basic Validation
    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, error: 'Missing required address fields' },
        { status: 400 }
      );
    }

    // Construct the payload expected by your util function
    const leadToSkip: LeadToSkip = {
      propertyAddress: {
        street: address,
        city,
        state,
        zip,
      },
      // Optional: If you passed names from the frontend, include them for better matching
      name:
        firstName && lastName
          ? {
              first: firstName,
              last: lastName,
            }
          : undefined,
    };

    // Call the shared logic
    const result = await skipTracePreForeClosureSingleLead(leadToSkip);

    if (!result || !result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result?.error || 'Skip trace failed at provider.',
        },
        { status: 502 }
      );
    }

    // Return the clean { success: true, contacts: [...] } structure
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
