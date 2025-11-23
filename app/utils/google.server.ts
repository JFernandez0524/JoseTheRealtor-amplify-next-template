import { Client, AddressComponent } from '@googlemaps/google-maps-services-js';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set in .env.local');
}

// 1. Instantiate the client (as per the docs)
const client = new Client({});

/**
 * Validates and geocodes an address string using the Google Maps Geocoding API.
 * Returns the first, best-matching result.
 */

/**
 * Parses Google's address_components array into a clean object.
 */
function parseAddressComponents(components: AddressComponent[]) {
  const result: { [key: string]: string } = {};

  for (const component of components) {
    // Use the first type (e.g., 'postal_code') as the key
    const type = component.types[0];
    result[type] = component.long_name;
  }

  // Build the final, clean address object
  return {
    street: `${result.street_number || ''} ${result.route || ''}`.trim(),
    city: result.locality || result.administrative_area_level_2 || '', // 'locality' is city, 'administrative_area_level_2' is county
    state: result.administrative_area_level_1 || '',
    zip: result.postal_code || '',
  };
}

export async function validateAddressWithGoogle(address: string) {
  console.log(`Validating address with Google: ${address}`);

  try {
    // 2. Call the geocode method
    const response = await client.geocode({
      params: {
        key: `${GOOGLE_MAPS_API_KEY}`, // API key for authentication
        address: address,
      },
      timeout: 1000, // milliseconds
    });

    // 3. Check for results
    if (response.data.results && response.data.results.length > 0) {
      const bestResult = response.data.results[0];

      // Use our new helper to parse the components
      const parsedComponents = parseAddressComponents(
        bestResult.address_components
      );

      // 4. Return the standardized, validated data
      return {
        success: true,
        formattedAddress: bestResult.formatted_address,
        location: bestResult.geometry.location, // { lat, lng }
        placeId: bestResult.place_id,
        // You can check 'partial_match' or 'types' for more validation
        isPartialMatch: bestResult.partial_match || false,
        components: parsedComponents, // { street, city, state, zip }
      };
    } else {
      throw new Error('No results found for that address.');
    }
  } catch (e: any) {
    // Handle API errors
    console.error(
      'Google Geocoding API error:',
      e.response?.data?.error_message || e.message
    );
    throw new Error('Address validation failed.');
  }
}
