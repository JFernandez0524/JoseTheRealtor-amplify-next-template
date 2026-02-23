import { NextRequest, NextResponse } from 'next/server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { createContact } from '@/app/utils/kvcore.server';

interface BoldTrailLeadRequest {
  street: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
  email?: string;
  phone?: string;
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: BoldTrailLeadRequest = await request.json();
    console.log('📥 BoldTrail lead request:', body);

    // 1. Validate address
    const fullAddress = body.address || `${body.street}, ${body.city}, ${body.state} ${body.zip}`;
    let validatedAddress;
    
    try {
      const result = await validateAddressWithGoogle(fullAddress);
      validatedAddress = {
        street: result.components.street,
        city: result.components.city,
        state: result.components.state,
        zip: result.components.zip,
        coordinates: result.location ? { lat: result.location.latitude, lng: result.location.longitude } : undefined
      };
      console.log('✅ Address validated:', validatedAddress);
    } catch (error) {
      console.error('❌ Address validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid address. Please enter a valid property address.' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // 2. Get Zestimate
    let zestimate = 0;
    let propertyData = null;

    try {
      const coords = body.lat && body.lng 
        ? { lat: body.lat, lng: body.lng }
        : validatedAddress.coordinates;

      const result = await analyzeBridgeProperty({
        street: validatedAddress.street || body.street,
        city: validatedAddress.city || body.city || '',
        state: validatedAddress.state || body.state || '',
        zip: validatedAddress.zip || body.zip || '',
        lat: coords?.lat,
        lng: coords?.lng
      });

      zestimate = result.valuation?.zestimate || 0;
      propertyData = result.valuation;
      console.log('💰 Zestimate retrieved:', zestimate);
    } catch (error) {
      console.error('⚠️ Zestimate lookup failed:', error);
    }

    // 3. Create contact in kvCORE
    if (body.name || body.email || body.phone) {
      const nameParts = (body.name || '').trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'Lead';

      await createContact({
        firstName,
        lastName,
        email: body.email,
        phone: body.phone,
        dealType: 'seller',
        source: 'Estate Sale Landing Page',
        notes: `Property: ${validatedAddress.street || body.street}, ${validatedAddress.city || body.city}, ${validatedAddress.state || body.state}\nEstimated Value: $${zestimate.toLocaleString()}\nLead Source: BoldTrail Estate Sale Landing Page`,
        tags: ['boldtrail-estate-sale', 'probate-landing-page', 'nj-probate-2026']
      });
    }

    // 4. Return response
    return NextResponse.json({
      success: true,
      valuation: {
        zestimate,
        address: validatedAddress.street || body.street,
        city: validatedAddress.city || body.city,
        state: validatedAddress.state || body.state,
        zip: validatedAddress.zip || body.zip,
      },
      property: propertyData ? {
        beds: propertyData.beds,
        baths: propertyData.baths,
        sqft: propertyData.sqft,
        yearBuilt: propertyData.yearBuilt,
      } : null,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error: any) {
    console.error('❌ BoldTrail lead API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        message: error.message 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}
