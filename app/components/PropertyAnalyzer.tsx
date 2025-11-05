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
import { AnalysisResult } from '@/app/types/analysis';
import { getFrontEndAuthSession } from '@/app/utils/amplifyFrontEndUser';

// --- Type Definitions (no change) ---
type GoogleAutocomplete = {
  getPlace: () => { formatted_address?: string };
};
const libraries: 'places'[] = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

export default function PropertyAnalyzer() {
  // --- State Hooks (no change) ---
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const [authStatus, setAuthStatus] = useState<
    'configuring' | 'authenticated' | 'unauthenticated'
  >('configuring');

  // --- useEffects and Handlers (no change) ---
  useEffect(() => {
    async function checkAuth() {
      const session = await getFrontEndAuthSession();
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    }
    checkAuth();
  }, []);

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
      {/* 👇 THIS IS THE NEW WRAPPER DIV 👇
        It adds margin-top (mt-8) and styles the form/results
        as a distinct "card" with a shadow, border, and padding.
      */}
      <div className='w-full max-w-2xl mt-8 bg-white p-6 rounded-lg shadow-md border'>
        {/* --- Analyzer Form --- */}
        <form
          onSubmit={handleSubmit}
          className='flex flex-col sm:flex-row gap-2 w-full'
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

          {result && (
            // We removed the 'mt-8' from here since it's on the parent div
            <div className='mt-6 bg-white'>
              <h2 className='text-2xl font-semibold mb-4'>{result.address}</h2>

              {/* ... (all your existing result cards: Property Details, Cash Offer, Map, etc.) ... */}

              <DataAttribution />

              {authStatus === 'unauthenticated' && <SignUpCTA />}
            </div>
          )}
        </div>
      </div>
    </LoadScript>
  );
}
