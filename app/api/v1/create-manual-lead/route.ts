import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { createLead } from '@/app/utils/aws/data/lead.server';

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
      standardizedAddress: ownerAddr.formattedAddress as any,
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
