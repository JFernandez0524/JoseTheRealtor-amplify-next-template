import axios from 'axios';

interface ZillowPropertyData {
  zpid: string;
  zestimate: number;
  rentZestimate?: number;
  homeDetails: {
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    lotSize?: number;
    yearBuilt?: number;
    homeType?: string;
  };
  priceHistory: Array<{
    date: string;
    price: number;
    event: string;
  }>;
  taxHistory: Array<{
    year: number;
    taxPaid: number;
    taxIncreaseRate?: number;
  }>;
  neighborhoodData: {
    medianHomeValue?: number;
    medianRent?: number;
    walkScore?: number;
  };
  comparableProperties: Array<{
    zpid: string;
    price: number;
    address: string;
    distance: number;
  }>;
  url: string;
  lastUpdated: string;
}

export async function fetchZillowData(
  address: string,
  city: string,
  state: string,
  zipCode: string
): Promise<ZillowPropertyData | null> {
  const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
  
  try {
    // Use Bridge API for Zestimate data - matching working bridge.server.ts format
    const response = await axios.get('https://api.bridgedataoutput.com/api/v2/zestimates_v2/zestimates', {
      headers: {
        'Authorization': `Bearer ${process.env.BRIDGE_API_KEY}`
      },
      params: {
        address: fullAddress,
        limit: 1
      }
    });

    const data = response.data;
    const property = data.bundle?.[0];
    
    if (!property) {
      return null;
    }

    return {
      zpid: property.zpid,
      zestimate: property.zestimate,
      rentZestimate: property.rentalZestimate,
      homeDetails: {
        bedrooms: undefined,
        bathrooms: undefined,
        livingArea: undefined,
        lotSize: undefined,
        yearBuilt: undefined,
        homeType: undefined
      },
      priceHistory: [], // Not available in this endpoint
      taxHistory: [],   // Not available in this endpoint
      neighborhoodData: {
        medianHomeValue: undefined,
        medianRent: undefined,
        walkScore: undefined
      },
      comparableProperties: [],
      url: property.zillowUrl,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Bridge API Zillow error:', error);
    return null;
  }
}

export function calculateEstimatedEquity(
  zestimate: number,
  mortgageBalance: number = 0
): number {
  return Math.max(0, zestimate - mortgageBalance);
}
