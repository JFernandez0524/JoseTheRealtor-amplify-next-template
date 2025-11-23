import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { createLead } from '@/app/utils/aws/data/lead.server';
import { type Schema } from '@/amplify/data/resource';

export const dynamic = 'force-dynamic';

type Lead = Schema['Lead']['type'];

export async function POST(req: NextRequest) {
  const authenticated = await AuthIsUserAuthenticatedServer();
  if (!authenticated) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') || '';

  // --- WORKFLOW 1: Validate Address ---
  if (contentType.includes('application/json')) {
    try {
      let lead: Lead = await req.json();

      let googleValidationPayload: any = null;

      // 1. Validate the address
      const fullAddress = `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`;
      const validation = await validateAddressWithGoogle(fullAddress);
      googleValidationPayload = validation;
      if (!validation.success || validation.isPartialMatch) {
        throw new Error('Google address validation failed.');
      }

      lead = {
        ...lead,
        ownerAddress: validation.components.street,
        ownerCity: validation.components.city,
        ownerState: validation.components.state,
        ownerZip: validation.components.zip,
        latitude: validation.location.lat,
        longitude: validation.location.lng,
        skipTraceStatus: 'PENDING',
      };

      // Update lead with standardized address components

      // 2. Create the base Lead record
      const newLead = await createLead(lead);
      return NextResponse.json({
        message: '✅ Lead added and processed successfully',
        lead: newLead,
      });
    } catch (error: any) {
      console.error('Manual lead error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // --- WORKFLOW 2: CSV FORM-DATA UPLOAD ---
  // This is the *wrong* pattern and will time out.
  // We will return an error and you must update your frontend.
  if (contentType.includes('multipart/form-data')) {
    console.error(
      'CSV upload to API route is not supported. Use S3 direct upload.'
    );
    return NextResponse.json(
      {
        error:
          'CSV upload via this API is not supported and will time out. Please update client to use S3 direct upload.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Unsupported content type' },
    { status: 400 }
  );
}
