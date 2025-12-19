import { NextResponse } from 'next/server';
import axios from 'axios';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;

/**
 * 🧹 CITY CLEANER
 * Converts "City of Orange" to "Orange" to match Zillow/Bridge standards.
 */
const cleanCityName = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .trim();
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, address: rawAddressInput } = body;
    let { standardizedAddress } = body;

    // Handle incoming standardizedAddress format
    if (
      typeof standardizedAddress === 'string' &&
      standardizedAddress.startsWith('{')
    ) {
      try {
        standardizedAddress = JSON.parse(standardizedAddress);
      } catch (e) {}
    }

    const street =
      standardizedAddress?.street?.S ||
      standardizedAddress?.street ||
      rawAddressInput ||
      '';
    const rawCity =
      standardizedAddress?.city?.S || standardizedAddress?.city || '';
    const state =
      standardizedAddress?.state?.S || standardizedAddress?.state || '';
    const zip = standardizedAddress?.zip?.S || standardizedAddress?.zip || '';

    // 🎯 Process the city name to avoid "City of" mismatches
    const city = cleanCityName(rawCity);

    if (!BRIDGE_API_KEY) throw new Error('Missing BRIDGE_API_KEY');

    // 🚀 STEP 1: INITIAL ZESTIMATE WITH STATE LOCK
    const zParams: any = {
      access_token: BRIDGE_API_KEY,
      limit: 1,
      address: street,
      city: city,
      state: state, // 🔒 Lock search to target state
      postalCode: zip,
    };

    // 📝 LOGGING: Debug exactly what is being sent to the API
    console.log('--- BRIDGE API OUTBOUND REQUEST ---');
    console.log('Original Input:', { street, rawCity, state, zip });
    console.log('Processed Params:', { street, city, state, zip });
    console.log('------------------------------------');

    const zRes = await axios.get(
      `https://api.bridgedataoutput.com/api/v2/zestimates_v2/zestimates`,
      { params: zParams }
    );

    let valuation = zRes.data.bundle?.[0];

    // 🛡️ STATE GUARD: Catch "fuzzy" cross-country matches before proceeding
    if (valuation && state && valuation.state !== state) {
      console.warn(
        `⚠️ State mismatch: Expected ${state} but got ${valuation.state}. Ignoring record.`
      );
      valuation = null;
    }

    let zpid = valuation?.zpid;
    const targetState = valuation?.state || state;

    // 🚀 STEP 2: ASSESSMENT WATERFALL
    let assessment = null;

    if (zpid) {
      const resA = await axios.get(
        `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
        {
          params: {
            access_token: BRIDGE_API_KEY,
            zpid,
            limit: 1,
            'address.state': targetState, // 🔒 Guard
          },
        }
      );
      assessment = resA.data.bundle?.[0];
    }

    if (!assessment && lat && lng) {
      const resB = await axios.get(
        `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
        {
          params: {
            access_token: BRIDGE_API_KEY,
            near: `${lng},${lat}`,
            radius: '0.01mi',
            limit: 1,
            'address.state': targetState, // 🔒 Guard
          },
        }
      );
      if (resB.data.bundle?.[0]?.state === targetState)
        assessment = resB.data.bundle[0];
    }

    if (!assessment && street) {
      const resC = await axios.get(
        `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
        {
          params: {
            access_token: BRIDGE_API_KEY,
            'address.full': street,
            'address.city': city,
            'address.state': targetState, // 🔒 Guard
            limit: 1,
          },
        }
      );
      if (resC.data.bundle?.[0]?.state === targetState)
        assessment = resC.data.bundle[0];

      // 🏢 CONDO/UNIT FIX
      if (
        !assessment &&
        street.toLowerCase().match(/\b(apt|unit|#|fl|floor)\b/)
      ) {
        const baseAddress = street
          .split(/\s+(?:apt|unit|#|fl|floor)\b/i)[0]
          .trim();
        const resCondo = await axios.get(
          `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
          {
            params: {
              access_token: BRIDGE_API_KEY,
              'address.street': baseAddress,
              'address.city': city || valuation?.city,
              'address.state': targetState,
              limit: 1,
            },
          }
        );
        assessment = resCondo.data.bundle?.[0];
      }
    }

    // 🚀 STEP 3: TRANSACTION HISTORY
    const parcelID = assessment?.parcelID || valuation?.parcelID;
    let history = [];
    if (parcelID || street) {
      const [hResByID, hResByAddr] = await Promise.all([
        parcelID
          ? axios
              .get(`https://api.bridgedataoutput.com/api/v2/pub/transactions`, {
                params: { access_token: BRIDGE_API_KEY, parcelID, limit: 15 },
              })
              .catch(() => ({ data: { bundle: [] } }))
          : Promise.resolve({ data: { bundle: [] } }),
        axios
          .get(`https://api.bridgedataoutput.com/api/v2/pub/transactions`, {
            params: {
              access_token: BRIDGE_API_KEY,
              'address.full': street,
              'address.city': city,
              'address.state': targetState,
              limit: 15,
            },
          })
          .catch(() => ({ data: { bundle: [] } })),
      ]);
      const rawHistory = [
        ...(hResByID.data.bundle || []),
        ...(hResByAddr.data.bundle || []),
      ];
      history = rawHistory
        .filter(
          (item, index, self) =>
            index ===
            self.findIndex(
              (t) =>
                t.recordingDate === item.recordingDate &&
                t.salesPrice === item.salesPrice
            )
        )
        .sort(
          (a, b) =>
            new Date(b.recordingDate).getTime() -
            new Date(a.recordingDate).getTime()
        );
    }

    return NextResponse.json({
      success: true,
      valuation: valuation || null,
      assessment: assessment || null,
      parcel: assessment || null,
      history: history,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
