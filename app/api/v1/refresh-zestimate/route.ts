import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import axios from 'axios';

const bridgeClient = axios.create({
  baseURL: 'https://api.bridgedataoutput.com/api/v2',
  headers: { Authorization: `Bearer ${process.env.BRIDGE_API_KEY}` },
});

export async function POST(request: NextRequest) {
  try {
    const { leadId, street, city, state, zip, latitude, longitude, zpid } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    let zillowData: any = null;

    if (zpid) {
      // Direct zpid lookup — user pasted a Zillow URL
      const res = await bridgeClient.get('/zestimates_v2/zestimates', {
        params: { zpid, limit: 1 },
      });
      const bundle = res.data.bundle;
      if (!bundle?.length) {
        return NextResponse.json({ error: 'No Zestimate data found for this Zillow URL' }, { status: 404 });
      }
      const best = bundle[0];
      zillowData = {
        zestimate: best.zestimate,
        zpid: best.zpid || zpid,
        zillowUrl: `https://www.zillow.com/homes/${best.zpid || zpid}_zpid/`,
        address: best.address,
        rentalZestimate: best.rentalZestimate,
      };
    } else {
      // Address-based lookup
      const result = await analyzeBridgeProperty({ street, city, state, zip, lat: latitude, lng: longitude });
      if (!result.valuation) {
        return NextResponse.json({ error: 'No Zestimate data found' }, { status: 404 });
      }
      const v = result.valuation;
      zillowData = {
        zestimate: v.zestimate,
        zpid: v.zpid,
        zillowUrl: v.zillowUrl || `https://www.zillow.com/homes/${v.zpid}_zpid/`,
        address: v.address,
        rentalZestimate: v.rentalZestimate,
      };
    }

    const { errors } = await cookiesClient.models.PropertyLead.update({
      id: leadId,
      zestimate: zillowData.zestimate,
      zillowZpid: zillowData.zpid,
      zillowUrl: zillowData.zillowUrl,
      zillowAddress: zillowData.address,
      rentZestimate: zillowData.rentalZestimate,
      zillowLastUpdated: new Date().toISOString(),
    });

    if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));

    return NextResponse.json({ success: true, zillowData });
  } catch (error: any) {
    console.error('Refresh Zestimate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh Zestimate' }, { status: 500 });
  }
}
