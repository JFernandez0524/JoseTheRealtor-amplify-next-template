'use client';

import { GoogleMap, Marker } from '@react-google-maps/api';
import { AnalysisResult } from '@/app/types/analysis'; // Adjust path
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

  return (
    <div className='mt-6 bg-white'>
      <h2 className='text-2xl font-semibold mb-4'>{result.address}</h2>

      {/* --- Building Details Section --- */}
      <div className='mb-4 p-4 bg-gray-50 rounded-lg'>
        <h3 className='text-xl font-semibold mb-2'>Property Details</h3>
        <div className='grid grid-cols-2 gap-2 text-sm'>
          <span>
            <strong>Year Built:</strong> {result.building.yearBuilt || 'N/A'}
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
            <strong>Condition:</strong> {result.building.condition || 'N/A'}
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
              <strong>Metric ({result.marketReport.metricType}):</strong>
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
  );
}
