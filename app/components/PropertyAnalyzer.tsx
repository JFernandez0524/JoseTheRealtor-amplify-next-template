'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import {
  LoadScript,
  Autocomplete,
  GoogleMap,
  Marker,
} from '@react-google-maps/api';
import SignUpCTA from './SignUpCTA';
import DataAttribution from './DataAttribution';
// 1. Import your new type
import { AnalysisResult } from '@/app/types/analysis'; // Ensure this path is correct
// 1. Import your new session function
import { getFrontEndAuthSession } from '@/app/utils/amplifyFrontEndUser'; // Ensure this path is correct

// This type is a stand-in for the Google Autocomplete instance
type GoogleAutocomplete = {
  getPlace: () => { formatted_address?: string };
};

// Define the Google Maps libraries to load
const libraries: 'places'[] = ['places'];

// Define the map container style
const mapContainerStyle = {
  width: '100%',
  height: '300px', // You can adjust this height
  borderRadius: '0.5rem',
  marginTop: '1.5rem', // 24px
};

export default function PropertyAnalyzer() {
  // --- State Hooks ---
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);

  // 2. Add state to track auth status
  const [authStatus, setAuthStatus] = useState<
    'configuring' | 'authenticated' | 'unauthenticated'
  >('configuring');

  // 3. Fetch session on mount to check auth status
  useEffect(() => {
    async function checkAuth() {
      // 👇 USE THE NEW FUNCTION HERE
      const session = await getFrontEndAuthSession();
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    }
    checkAuth();
  }, []); // Runs once on mount

  // --- Handlers (onLoad, onPlaceChanged, handleSubmit - no change) ---
  const onLoad = (autocomplete: GoogleAutocomplete) => {
    autocompleteRef.current = autocomplete;
  };
  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      const formattedAddress = place.formatted_address;
      if (formattedAddress) {
        setAddress(formattedAddress);
      }
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/v1/analyze-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze property.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={libraries}
    >
      <div className='w-full max-w-2xl'>
        {/* --- Analyzer Form (no change) --- */}
        <form
          onSubmit={handleSubmit}
          className='flex flex-col sm:flex-row gap-2 w-full mt-4'
        >
          <Autocomplete
            onLoad={onLoad}
            onPlaceChanged={onPlaceChanged}
            className='flex-grow'
          >
            <input
              type='text'
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder='Enter a property address'
              className='w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
            />
          </Autocomplete>
          <button
            type='submit'
            className='bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400'
            disabled={isLoading}
          >
            {isLoading ? <Loader /> : 'Analyze'}
          </button>
        </form>

        {/* --- Results Display --- */}
        <div className='w-full max-w-2xl'>
          {error && (
            <div className='mt-6 p-4 bg-red-100 text-red-700 rounded-md'>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* 👇 THIS IS THE FULL RESULT BLOCK 👇 */}
          {result && (
            <div className='mt-8 p-6 bg-white border rounded-lg shadow-md'>
              <h2 className='text-2xl font-semibold mb-4'>{result.address}</h2>

              {/* --- Building Details Section --- */}
              <div className='mb-4 p-4 bg-gray-50 rounded-lg'>
                <h3 className='text-xl font-semibold mb-2'>Property Details</h3>
                <div className='grid grid-cols-2 gap-2 text-sm'>
                  <span>
                    <strong>Year Built:</strong>{' '}
                    {result.building.yearBuilt || 'N/A'}
                  </span>
                  <span>
                    <strong>Sq. Ft.:</strong>{' '}
                    {result.building.squareFeet?.toLocaleString() || 'N/A'}
                  </span>
                  <span>
                    <strong>Beds:</strong> {result.building.bedrooms || 'N/A'}
                  </span>
                  <span>
                    <strong>Baths:</strong> {result.building.baths || 'N/A'}
                  </span>
                  <span>
                    <strong>Quality:</strong> {result.building.quality || 'N/A'}
                  </span>
                  <span>
                    <strong>Condition:</strong>{' '}
                    {result.building.condition || 'N/A'}
                  </span>
                </div>
              </div>

              {/* --- Financial Analysis --- */}
              <div className='space-y-3'>
                <div>
                  <span className='font-semibold'>Zestimate®:</span>
                  <span className='ml-2 text-lg font-bold text-green-700'>
                    ${result.zestimate?.toLocaleString()}
                  </span>
                </div>

                {/* --- Potential Cash Offer --- */}
                {result.cashOffer && (
                  <div className='my-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-center'>
                    <span className='block text-lg font-semibold text-yellow-900'>
                      Potential "As-Is" Cash Offer
                    </span>
                    <span className='block text-3xl font-bold text-yellow-900'>
                      ~$
                      {result.cashOffer.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className='block text-xs text-yellow-700'>
                      (75% of Zestimate. Subject to verification.)
                    </span>
                  </div>
                )}
                {/* --- End Cash Offer Section --- */}

                <div>
                  <span className='font-semibold'>Last Sold Price:</span>
                  <span className='ml-2'>
                    ${result.lastSoldPrice?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className='font-semibold'>Rent Zestimate®:</span>
                  <span className='ml-2'>
                    ${result.rentZestimate?.toLocaleString() || 'N/A'}/mo
                  </span>
                </div>

                <hr className='my-4' />

                <h3 className='text-xl font-semibold'>Quick Analysis</h3>
                <div>
                  <span className='font-semibold'>Fix & Flip:</span>
                  <span className='ml-2'>{result.fixAndFlipAnalysis}</span>
                </div>
                <div>
                  <span className='font-semibold'>Buy & Hold:</span>
                  <span className='ml-2'>{result.buyAndHoldAnalysis}</span>
                </div>
              </div>

              {/* --- Market Data Section --- */}
              {result.marketReport?.region && (
                <div className='mt-4 p-4 bg-blue-50 rounded-lg'>
                  <h3 className='text-xl font-semibold mb-2'>Market Report</h3>
                  <div className='text-sm'>
                    <span>
                      <strong>Region:</strong> {result.marketReport.region}
                    </span>
                    <br />
                    <span>
                      <strong>
                        Metric ({result.marketReport.metricType}):
                      </strong>
                      {result.marketReport.dataValue?.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* --- Google Map --- */}
              {result.location && (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={result.location}
                  zoom={16}
                >
                  <Marker position={result.location} />
                </GoogleMap>
              )}

              <DataAttribution />

              {/* --- Sign Up CTA (Uses our local authStatus) --- */}
              {authStatus === 'unauthenticated' && <SignUpCTA />}
            </div>
          )}
        </div>
      </div>
    </LoadScript>
  );
}
