// This type definition is now globally reusable
export type AnalysisResult = {
  success: boolean;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  zestimate: number;
  lastSoldPrice: number;
  rentZestimate: number;
  fixAndFlipAnalysis: string;
  buyAndHoldAnalysis: string;
  building: {
    yearBuilt: number | null;
    bedrooms: number | null;
    baths: number | null;
    stories: number | null;
    quality: string | null;
    condition: string | null;
    squareFeet: number | null;
  };
  marketReport: {
    region: string | null;
    dataValue: number | null;
    metricType: string | null;
  };
  location: {
    lat: number;
    lng: number;
  };
  cashOffer: number | null;
};
