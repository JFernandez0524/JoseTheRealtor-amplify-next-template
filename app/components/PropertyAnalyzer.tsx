'use client';

import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api'; // 👈 Hook, not component
import { AnalysisResult } from '@/app/types/analysis';
import { getFrontEndAuthSession } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { useFormFocus } from '@/app/context/FormFocusContext';

import AnalyzerForm from './AnalyzerForm';
import AnalyzerResults from './AnalyzerResults';

const libraries: 'places'[] = ['places'];

export default function PropertyAnalyzer() {
  // 1. 👇 Load Google Maps API via Hook
  // This prevents the "google api is already presented" crash
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [address, setAddress] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    'configuring' | 'authenticated' | 'unauthenticated'
  >('configuring');

  const { setHasAnalysisRun } = useFormFocus();

  useEffect(() => {
    async function checkAuth() {
      const session = await getFrontEndAuthSession();
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    }
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
    setHasAnalysisRun(true);
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

  // 2. Conditional Render based on isLoaded
  if (!isLoaded) {
    return (
      <div className='p-4 bg-white rounded-lg shadow-md mt-8 text-center'>
        Loading Maps...
      </div>
    );
  }

  return (
    <div className='w-full max-w-2xl mt-8 bg-white p-6 rounded-lg shadow-md border'>
      <AnalyzerForm
        address={address}
        setAddress={setAddress}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />

      <div className='w-full max-w-2xl'>
        {error && (
          <div className='mt-6 p-4 bg-red-100 text-red-700 rounded-md'>
            <strong>Error:</strong> {error}
          </div>
        )}

        <AnalyzerResults result={result} authStatus={authStatus} />
      </div>
    </div>
  );
}
