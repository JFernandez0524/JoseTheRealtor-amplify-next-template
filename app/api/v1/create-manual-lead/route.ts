/**
 * POST /api/v1/create-manual-lead
 *
 * Creates a single PropertyLead record manually (without CSV upload).
 * Address components must be pre-validated by the Google Places API on the client.
 * Fetches a Zestimate from Bridge API at creation time (non-fatal if it fails).
 *
 * AUTH: Required (Cognito JWT via cookies)
 * REQUEST BODY:
 *   { type, ownerLastName, ownerFirstName?, phone?, ownerAddr, adminFirstName?, adminLastName?, adminAddr? }
 *   ownerAddr / adminAddr: { street, city, state, zip, county?, lat?, lng? }
 *   Probate leads require adminFirstName, adminLastName, adminAddr.
 * RESPONSE: { success: true, lead: PropertyLead }
 *
 * CALLED BY: Manual lead creation form
 */
import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { createLead } from '@/app/utils/aws/data/lead.server';
import { isValidName, formatPhoneE164 } from '@/app/utils/leadValidation';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, ownerFirstName, ownerLastName, phone, ownerAddr, adminFirstName, adminLastName, adminAddr } = await request.json();

    if (!type || !ownerAddr || !ownerLastName) {
      return NextResponse.json({ error: 'type, ownerLastName, and ownerAddr are required' }, { status: 400 });
    }

    if (type === 'PROBATE' && (!adminFirstName || !adminLastName || !adminAddr)) {
      return NextResponse.json({ error: 'adminFirstName, adminLastName, and adminAddr are required for Probate leads' }, { status: 400 });
    }

    // Field-format validation (defense-in-depth — the client validates too, but
    // direct API callers must not bypass it). Names: letters + spaces only.
    if (ownerFirstName && !isValidName(ownerFirstName)) {
      return NextResponse.json({ error: 'ownerFirstName may only contain letters and spaces (max 50)' }, { status: 400 });
    }
    if (!isValidName(ownerLastName)) {
      return NextResponse.json({ error: 'ownerLastName may only contain letters and spaces (max 50)' }, { status: 400 });
    }
    if (type === 'PROBATE') {
      if (!isValidName(adminFirstName)) {
        return NextResponse.json({ error: 'adminFirstName may only contain letters and spaces (max 50)' }, { status: 400 });
      }
      if (!isValidName(adminLastName)) {
        return NextResponse.json({ error: 'adminLastName may only contain letters and spaces (max 50)' }, { status: 400 });
      }
    }

    // Phone is optional, but if provided it must be a valid US number.
    let normalizedPhone: string | null = null;
    if (phone) {
      normalizedPhone = formatPhoneE164(phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'phone must be a valid 10-digit US phone number' }, { status: 400 });
      }
    }

    // Address components come pre-parsed from Places API on the client — no server re-validation needed
    let zestimate: number | null = null;
    let zillowZpid: string | null = null;
    const latitude: number | null = ownerAddr.lat ?? null;
    const longitude: number | null = ownerAddr.lng ?? null;

    try {
      const propertyData = await analyzeBridgeProperty({
        street: ownerAddr.street,
        city: ownerAddr.city,
        state: ownerAddr.state,
        zip: ownerAddr.zip,
        lat: ownerAddr.lat,
        lng: ownerAddr.lng,
      });

      if (propertyData.success && propertyData.valuation) {
        zestimate = propertyData.valuation.zestimate ?? null;
        zillowZpid = propertyData.valuation.zpid ?? null;
      }
    } catch (error) {
      console.error('Zestimate fetch failed (non-fatal):', error);
    }

    const lead = await createLead({
      type,
      ownerFirstName: ownerFirstName || null,
      ownerLastName,
      ownerAddress: ownerAddr.street || ownerAddr.formattedAddress,
      ownerCity: ownerAddr.city,
      ownerState: ownerAddr.state,
      ownerZip: ownerAddr.zip,
      ownerCounty: ownerAddr.county || null,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      zestimate: zestimate ?? undefined,
      zillowZpid: zillowZpid ?? undefined,
      zestimateSource: zestimate ? 'ZILLOW' : undefined,
      zestimateDate: zestimate ? new Date().toISOString() : undefined,
      phones: normalizedPhone ? [normalizedPhone] : [],
      skipTraceStatus: normalizedPhone ? 'COMPLETED' : 'PENDING',
      ghlSyncStatus: 'PENDING',
      ghlContactId: null,
      listingStatus: 'off_market',
      uploadSource: 'manual_entry',
      validationStatus: 'VALID',
      ...(adminAddr && {
        adminFirstName: adminFirstName || null,
        adminLastName: adminLastName || null,
        adminAddress: adminAddr.street,
        adminCity: adminAddr.city,
        adminState: adminAddr.state,
        adminZip: adminAddr.zip,
      }),
    } as any);

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error('Create manual lead error:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', details: error.message },
      { status: 500 }
    );
  }
}
