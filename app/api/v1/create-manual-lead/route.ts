import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { createLead } from '@/app/utils/aws/data/lead.server';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, ownerFirstName, ownerLastName, phone, rawAddress, adminFirstName, adminLastName, rawAdminAddress } = await request.json();

    if (!type || !rawAddress || !ownerLastName) {
      return NextResponse.json({ error: 'type, ownerLastName, and rawAddress are required' }, { status: 400 });
    }

    if (type === 'PROBATE' && (!adminFirstName || !adminLastName || !rawAdminAddress)) {
      return NextResponse.json({ error: 'adminFirstName, adminLastName, and rawAdminAddress are required for Probate leads' }, { status: 400 });
    }

    // Parse and validate the owner address
    const ownerValidation = await validateAddressWithGoogle(rawAddress);
    if (!ownerValidation.success) {
      return NextResponse.json({ error: 'Could not validate property address. Please try a more specific address.' }, { status: 400 });
    }

    const { components, location, formattedAddress } = ownerValidation;

    // Parse admin address for Probate leads
    let adminComponents: typeof components | null = null;
    if (type === 'PROBATE' && rawAdminAddress) {
      const adminValidation = await validateAddressWithGoogle(rawAdminAddress);
      if (adminValidation.success) {
        adminComponents = adminValidation.components;
      }
    }

    // Fetch Zestimate — fail open (don't block lead creation if Bridge API is down)
    let zestimate: number | null = null;
    let zillowZpid: string | null = null;
    let latitude: number | null = location?.lat ?? null;
    let longitude: number | null = location?.lng ?? null;

    try {
      const propertyData = await analyzeBridgeProperty({
        street: components.street,
        city: components.city,
        state: components.state,
        zip: components.zip,
        lat: location?.lat,
        lng: location?.lng,
      });

      if (propertyData.success && propertyData.valuation) {
        zestimate = propertyData.valuation.zestimate ?? null;
        zillowZpid = propertyData.valuation.zpid ?? null;
      }
    } catch (error) {
      console.error('Zestimate fetch failed (non-fatal):', error);
    }

    // CreateLeadInput inherits doorKnockQueue from the Amplify schema type (hasMany connection)
    // but it's not a field we can set at create time — cast to satisfy the type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = await createLead({
      type,
      ownerFirstName: ownerFirstName || null,
      ownerLastName,
      ownerAddress: components.street || formattedAddress,
      ownerCity: components.city,
      ownerState: components.state,
      ownerZip: components.zip,
      ownerCounty: components.county || null,
      standardizedAddress: formattedAddress as any,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      zestimate: zestimate ?? undefined,
      zillowZpid: zillowZpid ?? undefined,
      phones: phone ? [phone] : [],
      skipTraceStatus: phone ? 'COMPLETED' : 'PENDING',
      ghlSyncStatus: 'PENDING',
      ghlContactId: null,
      listingStatus: 'off_market',
      uploadSource: 'manual_entry',
      validationStatus: 'VALID',
      ...(adminComponents && {
        adminFirstName: adminFirstName || null,
        adminLastName: adminLastName || null,
        adminAddress: adminComponents.street,
        adminCity: adminComponents.city,
        adminState: adminComponents.state,
        adminZip: adminComponents.zip,
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
