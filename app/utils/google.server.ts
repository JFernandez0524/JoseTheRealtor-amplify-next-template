import { AddressValidationClient } from '@googlemaps/addressvalidation';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set in .env.local');
}

const addressValidationClient = new AddressValidationClient({
  apiKey: GOOGLE_MAPS_API_KEY,
});

/**
 * Validates an address using Google Address Validation API with USPS CASS.
 * Returns standardized address components with USPS postal city names.
 */
export async function validateAddressWithGoogle(address: string) {
  console.log(`Validating address with Google: ${address}`);

  try {
    const [response] = await addressValidationClient.validateAddress({
      address: {
        addressLines: [address],
      },
      enableUspsCass: true,
    });

    const result = response.result;
    const postalAddress = result?.address?.postalAddress;
    const uspsData = result?.uspsData;

    if (!postalAddress) {
      throw new Error('No results found for that address.');
    }

    // Use USPS standardized address when available
    const standardizedAddr = uspsData?.standardizedAddress;
    
    // Build street from USPS components
    let street = '';
    if (standardizedAddr) {
      street = standardizedAddr.firstAddressLine || '';
      // If it contains comma, it's the full line - extract just street
      if (street.includes(',')) {
        street = street.split(',')[0].trim();
      }
    } else {
      street = postalAddress.addressLines?.[0] || '';
    }
    
    // Build ZIP code with extension if available
    const zip = standardizedAddr?.zipCode ?
      (standardizedAddr.zipCodeExtension ? `${standardizedAddr.zipCode}-${standardizedAddr.zipCodeExtension}` : standardizedAddr.zipCode) :
      postalAddress.postalCode || '';
    
    // Helper to convert ALL CAPS to Title Case
    const toTitleCase = (str: string) => {
      if (!str) return str;
      return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    };
    
    return {
      success: true,
      formattedAddress: result?.address?.formattedAddress || '',
      location: result?.geocode?.location as any,
      placeId: (result?.address as any)?.placeId,
      isPartialMatch: result?.verdict?.addressComplete === false,
      components: {
        street: toTitleCase(street),
        city: toTitleCase(standardizedAddr?.city || postalAddress.locality || ''),
        county: postalAddress.administrativeArea || '',
        state: standardizedAddr?.state || postalAddress.administrativeArea || '',
        zip,
      },
    };
  } catch (e: any) {
    console.error('Google Address Validation API error:', e.message);
    throw new Error('Address validation failed.');
  }
}
