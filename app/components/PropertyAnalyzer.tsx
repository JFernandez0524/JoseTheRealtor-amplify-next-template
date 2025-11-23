'use client';

import { useState, useRef, useEffect } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { AnalysisResult } from '@/app/types/analysis';
import { getFrontEndAuthSession } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { useFormFocus } from '@/app/context/FormFocusContext';

// Import our new components
import AnalyzerForm from './AnalyzerForm';
import AnalyzerResults from './AnalyzerResults';

// Type for the Autocomplete instance
type GoogleAutocomplete = {
  getPlace: () => { formatted_address?: string };
};

// Define the Google Maps libraries to load
const libraries: 'places'[] = ['places'];

export default function PropertyAnalyzer() {
  // --- State Hooks ---
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const [authStatus, setAuthStatus] = useState<
    'configuring' | 'authenticated' | 'unauthenticated'
  >('configuring');

  // --- State from Context ---
  const { setHasAnalysisRun } = useFormFocus();

  // --- Auth Check Effect ---
  useEffect(() => {
    async function checkAuth() {
      const session = await getFrontEndAuthSession();
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    }
    checkAuth();
  }, []); // Runs once on mount

  // --- Google Maps Handlers ---
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

  // --- Form Submit Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement)?.blur(); // Close keyboard on mobile
    setHasAnalysisRun(true); // Tell the context an analysis has run
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
      <div className='w-full max-w-2xl mt-8 bg-white p-6 rounded-lg shadow-md border'>
        {/* --- Render the Form Component --- */}
        <AnalyzerForm
          address={address}
          setAddress={setAddress}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          onLoad={onLoad}
          onPlaceChanged={onPlaceChanged}
        />

        {/* --- Render the Results --- */}
        <div className='w-full max-w-2xl'>
          {error && (
            <div className='mt-6 p-4 bg-red-100 text-red-700 rounded-md'>
              <strong>Error:</strong> {error}
            </div>
          )}

          <AnalyzerResults result={result} authStatus={authStatus} />
        </div>
      </div>
    </LoadScript>
  );
}
