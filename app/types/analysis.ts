// This type definition is now globally reusable
// app/types/analysis.ts

export interface AnalysisResult {
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  zestimate: number | null;
  rentZestimate: number | null;
  lastSoldPrice: number | null;
  // The "Teaser" calculation we will do in the backend
  cashOffer: number | null;
  building: {
    yearBuilt: number | null;
    squareFeet: number | null;
    bedrooms: number | null;
    baths: number | null;
    description?: string;
  };
}
