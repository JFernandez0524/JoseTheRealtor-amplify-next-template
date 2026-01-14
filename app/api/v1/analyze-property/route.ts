import { NextResponse } from 'next/server';
import axios from 'axios';
// ✅ Import Server Utilities for Membership Protection
import {
  AuthIsUserAuthenticatedServer,
  AuthGetUserGroupsServer,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;

const cleanCityName = (city: string) => {
  if (!city) return '';
  return city
    .replace(/\b(city|town|borough|township|village)\s+of\s+/i, '')
    .trim();
};

// Generate multiple address variations to try
const generateAddressVariations = (street: string) => {
  if (!street) return [street];

  const variations = new Set<string>();
  variations.add(street); // Original

  // Helper function to apply address transformations
  const transform = (
    addr: string,
    options: {
      directionStyle: 'full' | 'usps' | 'zillow';
      removeOrdinals?: boolean;
      unitStyle?: 'abbreviated' | 'full';
    }
  ) => {
    let result = addr;

    // Remove ordinal suffixes if requested (but preserve unit numbers like "Unit 1st")
    if (options.removeOrdinals) {
      // Only remove ordinals from street numbers, not unit numbers
      result = result.replace(/^(\d+)(st|nd|rd|th)\b/gi, '$1');
    }

    // Apply direction style
    if (options.directionStyle === 'usps') {
      result = result
        .replace(/\bNorth\b/gi, 'N')
        .replace(/\bSouth\b/gi, 'S')
        .replace(/\bEast\b/gi, 'E')
        .replace(/\bWest\b/gi, 'W');
    } else if (options.directionStyle === 'zillow') {
      result = result
        .replace(/\bNorth\b/gi, 'No')
        .replace(/\bSouth\b/gi, 'So')
        .replace(/\bEast\b/gi, 'E')
        .replace(/\bWest\b/gi, 'W');
    }

    // Abbreviate street types
    result = result
      .replace(/\bStreet\b/gi, 'St')
      .replace(/\bAvenue\b/gi, 'Ave')
      .replace(/\bBoulevard\b/gi, 'Blvd')
      .replace(/\bDrive\b/gi, 'Dr')
      .replace(/\bRoad\b/gi, 'Rd')
      .replace(/\bLane\b/gi, 'Ln')
      .replace(/\bCourt\b/gi, 'Ct')
      .replace(/\bCircle\b/gi, 'Cir')
      .replace(/\bPlace\b/gi, 'Pl')
      .replace(/\bTerrace\b/gi, 'Ter')
      .replace(/\bParkway\b/gi, 'Pkwy');

    // Handle unit/apartment variations
    if (options.unitStyle === 'abbreviated') {
      result = result
        .replace(/\bApartment\b/gi, 'Apt')
        .replace(/\bUnit\b/gi, 'Unit') // Keep as Unit
        .replace(/\bSuite\b/gi, 'Ste')
        .replace(/\b#\s*/g, '#'); // Normalize # format
    }

    return result.trim();
  };

  // Generate variations with different combinations
  const configs = [
    { directionStyle: 'full' as const, removeOrdinals: false },
    { directionStyle: 'usps' as const, removeOrdinals: false },
    { directionStyle: 'zillow' as const, removeOrdinals: false },
    { directionStyle: 'full' as const, removeOrdinals: true },
    { directionStyle: 'usps' as const, removeOrdinals: true },
    { directionStyle: 'zillow' as const, removeOrdinals: true },
  ];

  configs.forEach((config) => {
    variations.add(transform(street, config));
    variations.add(transform(street, { ...config, unitStyle: 'abbreviated' }));
  });

  return Array.from(variations).filter((v) => v); // Remove any empty strings
};

export async function POST(req: Request) {
  try {
    // 🛡️ 1. AUTHENTICATION GUARD (Optional - allows public access)
    const isAuthenticated = await AuthIsUserAuthenticatedServer();
    
    // 🛡️ 2. MEMBERSHIP TIER CHECK (Optional - for premium features)
    const groups = isAuthenticated ? await AuthGetUserGroupsServer() : [];
    const isPremium = groups.includes('PRO') || groups.includes('AI_PLAN') || groups.includes('ADMINS');

    const body = await req.json();

    const {
      lat,
      lng,
      street: incomingStreet,
      city: incomingCity,
      state: incomingState,
      zip: incomingZip,
    } = body;

    let { standardizedAddress } = body;

    if (
      typeof standardizedAddress === 'string' &&
      standardizedAddress.startsWith('{')
    ) {
      try {
        standardizedAddress = JSON.parse(standardizedAddress);
      } catch (e) {}
    }

    const rawStreet =
      standardizedAddress?.street?.S ||
      standardizedAddress?.street ||
      incomingStreet ||
      '';
    const rawCity =
      standardizedAddress?.city?.S ||
      standardizedAddress?.city ||
      incomingCity ||
      '';
    const state =
      standardizedAddress?.state?.S ||
      standardizedAddress?.state ||
      incomingState ||
      '';
    const zip =
      standardizedAddress?.zip?.S ||
      standardizedAddress?.zip ||
      incomingZip ||
      '';

    const city = cleanCityName(rawCity);
    const streetVariations = generateAddressVariations(rawStreet);

    if (!BRIDGE_API_KEY) throw new Error('Missing BRIDGE_API_KEY');

    console.log('--- BRIDGE API OUTBOUND REQUEST ---');
    console.log('Original:', {
      street: rawStreet,
      city: rawCity,
      state,
      zip,
      lat,
      lng,
    });
    console.log('Address Variations:', streetVariations);
    console.log('------------------------------------');

    let valuation = null;
    let successfulVariation = null;

    // 🚀 STEP 1: Try all address variations
    for (const street of streetVariations) {
      const zParams: any = {
        access_token: BRIDGE_API_KEY,
        limit: 3,
        address: street,
        city: city,
        state: state,
        postalCode: zip,
      };

      try {
        const zRes = await axios.get(
          `https://api.bridgedataoutput.com/api/v2/zestimates_v2/zestimates`,
          { params: zParams }
        );

        if (zRes.data.bundle?.[0]) {
          valuation = zRes.data.bundle[0];
          successfulVariation = street;
          console.log(`✅ Address match found with variation: "${street}"`);
          break;
        }
      } catch (err) {
        console.log(`❌ No match for variation: "${street}"`);
      }
    }

    // 🚀 STEP 2: Coordinate fallback if no address match
    if (!valuation && lat && lng) {
      console.log('🔍 No address match. Trying coordinates...');

      const radii = ['0.01', '0.05', '0.1', '0.25'];

      for (const radius of radii) {
        const coordParams = {
          access_token: BRIDGE_API_KEY,
          limit: 10,
          near: `${lng},${lat}`,
          radius: radius,
        };

        try {
          const zResCoord = await axios.get(
            `https://api.bridgedataoutput.com/api/v2/zestimates_v2/zestimates`,
            { params: coordParams }
          );

          if (zResCoord.data.bundle?.[0]) {
            valuation = zResCoord.data.bundle[0];
            console.log(`✅ Match found at radius ${radius}mi`);
            break;
          }
        } catch (err) {
          console.error(`Error with radius ${radius}:`, err);
        }
      }
    }

    // 🛡️ STATE GUARD
    if (valuation && state && valuation.state !== state) {
      console.warn(
        `⚠️ State mismatch: Expected ${state}, got ${valuation.state}. Discarding.`
      );
      valuation = null;
    }

    const zpid = valuation?.zpid;
    const targetState = valuation?.state || state;

    // 🚀 STEP 3: Assessment waterfall
    let assessment = null;

    if (zpid) {
      try {
        const resA = await axios.get(
          `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
          {
            params: {
              access_token: BRIDGE_API_KEY,
              zpid,
              limit: 1,
              'address.state': targetState,
            },
          }
        );
        assessment = resA.data.bundle?.[0];
      } catch (err) {
        console.error('❌ Assessment by ZPID failed');
      }
    }

    if (!assessment && lat && lng) {
      const radii = ['0.01', '0.05', '0.1'];
      for (const radius of radii) {
        try {
          const resB = await axios.get(
            `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
            {
              params: {
                access_token: BRIDGE_API_KEY,
                near: `${lng},${lat}`,
                radius: `${radius}mi`,
                limit: 5,
                'address.state': targetState,
              },
            }
          );
          const stateMatch = resB.data.bundle?.find(
            (a: any) => a.address?.state === targetState
          );
          if (stateMatch) {
            assessment = stateMatch;
            break;
          }
        } catch (err) {
          console.error(`❌ Radius ${radius}mi failed`);
        }
      }
    }

    if (!assessment && streetVariations.length > 0) {
      for (const street of streetVariations) {
        try {
          const resC = await axios.get(
            `https://api.bridgedataoutput.com/api/v2/pub/assessments`,
            {
              params: {
                access_token: BRIDGE_API_KEY,
                'address.full': street,
                'address.city': city,
                'address.state': targetState,
                limit: 3,
              },
            }
          );
          const stateMatch = resC.data.bundle?.find(
            (a: any) => a.address?.state === targetState
          );
          if (stateMatch) {
            assessment = stateMatch;
            break;
          }
        } catch (err) {}
      }
    }

    return NextResponse.json({
      success: true,
      valuation: valuation || null,
      assessment: assessment || null,
      parcel: assessment || null,
      history: [],
      debug: {
        searched: {
          originalStreet: rawStreet,
          variations: streetVariations,
          successfulVariation,
          city,
          state,
          zip,
          lat,
          lng,
        },
        found: {
          valuation: !!valuation,
          assessment: !!assessment,
          zpid: zpid || null,
        },
      },
    });
  } catch (error: any) {
    console.error('SERVER ERROR:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}
