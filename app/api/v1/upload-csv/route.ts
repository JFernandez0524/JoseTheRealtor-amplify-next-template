import { NextRequest, NextResponse } from 'next/server';
import { AuthIsUserAuthenticatedServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import {
  createLead,
  type CreateLeadInput,
} from '@/app/utils/aws/data/lead.server';
import { type Schema } from '@/amplify/data/resource';

export const dynamic = 'force-dynamic';

// Define the type for the JSON body from your manual form
// This matches the state in your upload/page.tsx
type ManualLeadInput = Schema['PropertyLead']['type'];

export async function POST(req: NextRequest) {
  // 1. Authenticate user
  const authenticated = await AuthIsUserAuthenticatedServer();
  if (!authenticated) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  // In a real app, you might want to get the userId from the session here
  // For now, we'll assume the cookiesClient handles the 'owner' field automatically
  // or you can fetch the user sub if you need to manually set 'owner'.

  const contentType = req.headers.get('content-type') || '';

  try {
    // --- WORKFLOW A: CSV UPLOAD (multipart/form-data) ---
    // We block this because we want the client to upload directly to S3
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

    // --- WORKFLOW B: MANUAL UPLOAD (application/json) ---
    if (contentType.includes('application/json')) {
      // 2. Parse the body
      // We cast it to ManualLeadInput to get type safety on the incoming fields
      const body = (await req.json()) as ManualLeadInput;

      // 3. Validate the address with Google
      const fullAddress = `${body.ownerAddress}, ${body.ownerCity}, ${body.ownerState} ${body.ownerZip}`;
      const validation = await validateAddressWithGoogle(fullAddress);

      if (!validation.success || validation.isPartialMatch) {
        throw new Error(
          'Google address validation failed or returned a partial match.'
        );
      }

      // 4. Map the form data to your Database Schema
      // We use the CreateLeadInput type to ensure we match the DB schema
      const leadInput: CreateLeadInput = {
        // Spread the existing fields (names, etc.)
        // Note: You might need to ensure 'body' doesn't contain extra fields not in Schema
        ...body,

        // Overwrite address fields with Google's standardized data
        ownerAddress: validation.components.street,
        ownerCity: validation.components.city,
        ownerState: validation.components.state,
        ownerZip: validation.components.zip,
        standardizedAddress: validation.components,

        // Save coordinates
        latitude: validation.location.lat,
        longitude: validation.location.lng,

        // Set default status
        skipTraceStatus: 'PENDING',
      };

      // 5. Save to Database
      // We don't need to manually set 'owner' here because cookiesClient
      // uses the authenticated user's session to set it automatically.
      const newLead = await createLead(leadInput);

      return NextResponse.json({
        message: '✅ Lead added successfully',
        lead: newLead,
      });
    }

    // --- Fallback ---
    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Lead upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
