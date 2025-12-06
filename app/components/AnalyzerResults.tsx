'use client';

import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { AnalysisResult } from '@/app/types/analysis';
import DataAttribution from './DataAttribution';
import SignUpCTA from './SignUpCTA';

type AnalyzerResultsProps = {
  result: AnalysisResult | null;
  authStatus: 'configuring' | 'authenticated' | 'unauthenticated';
};

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

// Use your actual Map ID here if you have one, or keep the placeholder to suppress warnings
const MAP_ID = 'DEMO_MAP_ID';

export default function AnalyzerResults({
  result,
  authStatus,
}: AnalyzerResultsProps) {
  if (!result) {
    return null;
  }

  const {
    address,
    building,
    zestimate,
    rentZestimate,
    lastSoldPrice,
    cashOffer,
    location,
  } = result;

  return (
    <div className='mt-6 bg-white animate-in fade-in slide-in-from-bottom-4 duration-500'>
      <h2 className='text-2xl font-semibold mb-4 text-gray-800'>{address}</h2>

      {/* --- Property Facts --- */}
      <div className='mb-6 p-5 bg-slate-50 rounded-xl border border-slate-100'>
        <h3 className='text-lg font-semibold mb-3 text-slate-700'>
          Property Facts
        </h3>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div className='flex flex-col'>
            <span className='text-slate-500'>Year Built</span>
            <span className='font-medium text-slate-800'>
              {building.yearBuilt || '-'}
            </span>
          </div>
          <div className='flex flex-col'>
            <span className='text-slate-500'>Sq. Ft.</span>
            <span className='font-medium text-slate-800'>
              {building.squareFeet?.toLocaleString() || '-'}
            </span>
          </div>
          <div className='flex flex-col'>
            <span className='text-slate-500'>Bedrooms</span>
            <span className='font-medium text-slate-800'>
              {building.bedrooms || '-'}
            </span>
          </div>
          <div className='flex flex-col'>
            <span className='text-slate-500'>Bathrooms</span>
            <span className='font-medium text-slate-800'>
              {building.baths || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* --- Financial Analysis --- */}
      <div className='space-y-4'>
        <div className='flex items-baseline justify-between border-b pb-2'>
          <span className='font-medium text-gray-600'>
            Estimated Value (Zestimate®):
          </span>
          <span className='text-xl font-bold text-emerald-600'>
            {zestimate ? `$${zestimate.toLocaleString()}` : 'Not Available'}
          </span>
        </div>

        <div className='flex items-baseline justify-between border-b pb-2'>
          <span className='font-medium text-gray-600'>
            Est. Rent (Rent Zestimate®):
          </span>
          <span className='text-lg font-semibold text-gray-700'>
            {rentZestimate
              ? `$${rentZestimate.toLocaleString()}/mo`
              : 'Not Available'}
          </span>
        </div>

        <div className='flex items-baseline justify-between border-b pb-2'>
          <span className='font-medium text-gray-600'>Last Sold Price:</span>
          <span className='text-lg font-semibold text-gray-700'>
            {lastSoldPrice ? `$${lastSoldPrice.toLocaleString()}` : 'N/A'}
          </span>
        </div>

        {/* 🛑 NEW: Data Discrepancy Disclaimer */}
        <p className='text-xs text-gray-400 italic mt-2'>
          * Market values and Zestimates® are estimated and may vary from live
          market data. Recent updates may take time to reflect.
        </p>

        {/* --- Cash Offer Teaser --- */}
        {cashOffer && (
          <div className='my-6 p-6 bg-amber-50 border border-amber-200 rounded-xl text-center shadow-sm relative overflow-hidden'>
            <div className='relative z-10'>
              <span className='block text-sm font-bold text-amber-800 uppercase tracking-wide mb-1'>
                Potential "As-Is" Cash Offer
              </span>
              <span className='block text-4xl font-extrabold text-amber-900 mb-2'>
                ${cashOffer.toLocaleString()}
              </span>
              <p className='text-xs text-amber-700 max-w-xs mx-auto'>
                *Estimate based on 75% of market value. Final offer requires
                inspection.
              </p>
            </div>
            <div className='absolute -top-10 -right-10 w-32 h-32 bg-amber-100 rounded-full opacity-50 blur-2xl'></div>
          </div>
        )}
      </div>

      {/* --- Google Map --- */}
      {location && location.lat && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={location}
          zoom={18}
          options={{
            mapId: MAP_ID,
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          <MarkerF position={location} />
        </GoogleMap>
      )}

      <DataAttribution />

      {authStatus === 'unauthenticated' && (
        <div className='mt-8'>
          <SignUpCTA />
        </div>
      )}
    </div>
  );
}
