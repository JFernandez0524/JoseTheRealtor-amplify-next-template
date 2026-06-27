/**
 * POST /api/v1/boldtrail-lead
 *
 * External webhook endpoint for BoldTrail (kvCORE) lead ingestion.
 * Validates the property address, fetches a Zestimate, creates a kvCORE
 * contact, and syncs the contact to GHL.
 *
 * AUTH: None — public endpoint (CORS allowed from all origins)
 * REQUEST BODY: BoldTrailLeadRequest
 *   { street, city?, state?, zip?, lat?, lng?, address?, name?, email?, phone? }
 * RESPONSE: { success: true, contact: {...}, valuation: {...} }
 *
 * CORS: Open (intended to be called from BoldTrail's backend)
 * NOTE: Add signature verification if this endpoint is abused.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import { analyzeBridgeProperty } from '@/app/utils/bridge.server';
import { createContact } from '@/app/utils/kvcore.server';
import { createGhlClient, ghlUpdateContact } from '../../../../amplify/functions/shared/ghlClient';

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

    // 3. Send to GHL
    if (body.name || body.email || body.phone) {
      const nameParts = (body.name || '').trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'Lead';

      try {
        const locationId = process.env.GHL_LOCATION_ID;
        const apiKey = process.env.GHL_API_KEY;
        
        console.log('🔑 GHL credentials check:', { 
          hasLocationId: !!locationId, 
          hasApiKey: !!apiKey 
        });
        
        if (locationId && apiKey) {
          console.log('📤 Sending to GHL...');
          const ghl = createGhlClient(apiKey);
          const ghlRes = await ghl.post('/contacts/', {
            locationId,
            firstName,
            lastName,
            email: body.email,
            phone: body.phone,
            source: 'Estate Sale Landing Page',
            tags: ['landing-page-lead', 'estate-sale-inquiry', 'hot-lead'],
            customFields: [
              { id: 'p3NOYiInAERYbe0VsLHB', value: validatedAddress.street || body.street },
              { id: 'h4UIjKQvFu7oRW4SAY8W', value: validatedAddress.city || body.city },
              { id: '9r9OpQaxYPxqbA6Hvtx7', value: validatedAddress.state || body.state },
              { id: 'hgbjsTVwcyID7umdhm2o', value: validatedAddress.zip || body.zip },
              { id: '7wIe1cRbZYXUnc3WOVb2', value: zestimate.toString() },
              { id: 'sM3hEOHCJFoPyWhj1Vc8', value: Math.round(zestimate * 0.7).toString() },
              { id: 'oaf4wCuM3Ub9eGpiddrO', value: 'ESTATE SALE' },
              { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Probate Landing Page' }
            ]
          }).catch((err: any) => ({ data: err.response?.data, status: err.response?.status, isError: true }));

          const result = (ghlRes as any).data ?? ghlRes;
          const ghlStatus = (ghlRes as any).status ?? 200;
          if (!(ghlRes as any).isError) {
            console.log('✅ Lead sent to GHL:', result.contact?.id);

            const noteText = `🌐 Estate Sale Landing Page Inquiry\n\nSubmitted Name: ${body.name}\nEmail: ${body.email || 'Not provided'}\nPhone: ${body.phone}\nProperty: ${validatedAddress.street || body.street}, ${validatedAddress.city || body.city}, ${validatedAddress.state || body.state} ${validatedAddress.zip || body.zip}\nZestimate: $${zestimate.toLocaleString()}\nCash Offer: $${Math.round(zestimate * 0.7).toLocaleString()}\n\nSubmitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;

            await ghl.post(`/contacts/${result.contact.id}/notes`, { body: noteText, userId: locationId });
            console.log('✅ Note added with form details');
          } else if (ghlStatus === 400 && result?.meta?.contactId) {
            // Duplicate contact - add tags, custom fields, and note
            console.log(`🔄 Duplicate ${result.meta.matchingField} detected for ${result.meta.contactName}, updating with inquiry details`);

            await ghlUpdateContact(apiKey, result.meta.contactId, {
              tags: ['landing-page-lead', 'estate-sale-inquiry', 'hot-lead'],
              customFields: [
                { id: 'p3NOYiInAERYbe0VsLHB', value: validatedAddress.street || body.street },
                { id: 'h4UIjKQvFu7oRW4SAY8W', value: validatedAddress.city || body.city },
                { id: '9r9OpQaxYPxqbA6Hvtx7', value: validatedAddress.state || body.state },
                { id: 'hgbjsTVwcyID7umdhm2o', value: validatedAddress.zip || body.zip },
                { id: '7wIe1cRbZYXUnc3WOVb2', value: zestimate.toString() },
                { id: 'sM3hEOHCJFoPyWhj1Vc8', value: Math.round(zestimate * 0.7).toString() },
                { id: 'oaf4wCuM3Ub9eGpiddrO', value: 'ESTATE SALE' },
                { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Probate Landing Page' }
              ]
            });
            console.log('✅ Custom fields updated for existing contact');

            const noteText = `🌐 Estate Sale Landing Page Inquiry\n\nSubmitted Name: ${body.name}\nEmail: ${body.email || 'Not provided'}\nPhone: ${body.phone}\nProperty: ${validatedAddress.street || body.street}, ${validatedAddress.city || body.city}, ${validatedAddress.state || body.state} ${validatedAddress.zip || body.zip}\nZestimate: $${zestimate.toLocaleString()}\nCash Offer: $${Math.round(zestimate * 0.7).toLocaleString()}\n\nSubmitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
            await ghl.post(`/contacts/${result.meta.contactId}/notes`, { body: noteText, userId: locationId });
            console.log('✅ Note added with form details');
          } else {
            console.error('❌ GHL error:', result);
          }
        } else {
          console.error('❌ Missing GHL credentials');
        }
      } catch (error) {
        console.error('❌ Failed to send to GHL:', error);
      }
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
