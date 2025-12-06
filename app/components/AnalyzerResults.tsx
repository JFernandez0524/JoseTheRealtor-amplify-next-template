'use client';

import { GoogleMap, Marker } from '@react-google-maps/api';
import { AnalysisResult } from '@/app/types/analysis'; // Adjust path if needed
import DataAttribution from './DataAttribution';
import SignUpCTA from './SignUpCTA';

// Define the props this component needs
type AnalyzerResultsProps = {
  result: AnalysisResult | null;
  authStatus: 'configuring' | 'authenticated' | 'unauthenticated';
};

// Define the map container style
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

export default function AnalyzerResults({
  result,
  authStatus,
}: AnalyzerResultsProps) {
  if (!result) {
    return null; // Don't render anything if there are no results
  }

  // Destructure for cleaner access
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

      {/* --- Building Details Section --- */}
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
        {building.description && (
          <p className='mt-4 text-xs text-gray-500 italic border-t pt-2'>
            {building.description.length > 150
              ? `${building.description.substring(0, 150)}...`
              : building.description}
          </p>
        )}
      </div>

      {/* --- Financial Analysis --- */}
      <div className='space-y-4'>
        {/* Zestimate Display */}
        <div className='flex items-baseline justify-between border-b pb-2'>
          <span className='font-medium text-gray-600'>
            Estimated Value (Zestimate®):
          </span>
          <span className='text-xl font-bold text-emerald-600'>
            {zestimate ? `$${zestimate.toLocaleString()}` : 'Not Available'}
          </span>
        </div>

        {/* Rent Zestimate Display */}
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

        {/* Last Sold Price */}
        <div className='flex items-baseline justify-between border-b pb-2'>
          <span className='font-medium text-gray-600'>Last Sold Price:</span>
          <span className='text-lg font-semibold text-gray-700'>
            {lastSoldPrice ? `$${lastSoldPrice.toLocaleString()}` : 'N/A'}
          </span>
        </div>

        {/* --- Potential Cash Offer TEASER --- */}
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
            {/* Decorative background circle */}
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
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          <Marker position={location} />
        </GoogleMap>
      )}

      <DataAttribution />

      {/* --- Sign Up CTA (Uses our local authStatus) --- */}
      {authStatus === 'unauthenticated' && (
        <div className='mt-8'>
          <SignUpCTA />
        </div>
      )}
    </div>
  );
}
