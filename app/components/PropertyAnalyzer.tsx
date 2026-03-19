'use client';

import { useState, useEffect } from 'react';
import { useFormFocus } from '@/app/context/FormFocusContext';
import { Loader } from '@aws-amplify/ui-react';
import { AuthUser } from 'aws-amplify/auth';

import AnalyzerForm from './AnalyzerForm';
import PropertyReportView from './shared/PropertyReportView';

interface PropertyAnalyzerProps {
  user: AuthUser | null;
}

export default function PropertyAnalyzer({ user }: PropertyAnalyzerProps) {

  const [address, setAddress] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const isLoggedIn = !!user;
  const { setHasAnalysisRun } = useFormFocus();

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google) {
      setMapsLoaded(true);
      return;
    }

    // Load Google Maps API if not already loading
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => setMapsLoaded(true);
      document.head.appendChild(script);
    } else {
      // Script is loading, wait for it
      const checkLoaded = setInterval(() => {
        if (window.google) {
          setMapsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
    }
  }, []);

  /**
   * 🎯 HANDLE SUBMIT
   */
  const handleSubmit = async (e?: React.FormEvent, placeDetails?: any) => {
    if (e) e.preventDefault();

    setHasAnalysisRun(true);
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const payload = placeDetails
        ? {
            lat: placeDetails.lat,
            lng: placeDetails.lng,
            street: placeDetails.street,
            city: placeDetails.city,
            state: placeDetails.state,
            zip: placeDetails.zip,
          }
        : { address };

      console.log('🔍 Sending payload:', payload);

      const response = await fetch('/api/v1/analyze-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log('📦 Received data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze property');
      }

      if (!data.success || (!data.valuation && !data.assessment)) {
        throw new Error(
          data.error || 'Property not found. Please verify the address and try again.'
        );
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mapsLoaded) {
    return (
      <div className='flex flex-col items-center gap-4 py-20'>
        <Loader size='large' />
        <p className='text-slate-400 font-bold uppercase text-xs tracking-widest'>
          Loading Google Maps...
        </p>
      </div>
    );
  }

  return (
    <div className='w-full max-w-6xl flex flex-col items-center'>
      <div className='w-full max-w-2xl bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 mb-12 transform transition-all hover:shadow-indigo-100/50'>
        <AnalyzerForm
          address={address}
          setAddress={setAddress}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div className='p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3 mb-8'>
          <span className='text-lg'>⚠️</span> {error}
        </div>
      )}

      {isLoading && (
        <div className='flex flex-col items-center gap-6 py-20 mb-8'>
          <Loader size='large' />
          <div className='text-center'>
            <p className='text-slate-900 font-black uppercase text-xs tracking-[0.3em] mb-2'>
              Analyzing Property
            </p>
            <p className='text-slate-400 text-[10px] uppercase font-bold tracking-widest'>
              Fetching Zestimates & Public Records...
            </p>
          </div>
        </div>
      )}

      {result && !isLoading && (
        <PropertyReportView
          key={result.valuation?.zpid || result.assessment?.apn || Date.now()}
          marketData={result}
          isPremium={isLoggedIn}
          onSkipTrace={() => console.log('Skip trace triggered for member!')}
        />
      )}
    </div>
  );
}
