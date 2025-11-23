'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { type Schema } from '@/amplify/data/resource'; // Adjust path
import { Loader } from '@aws-amplify/ui-react';
import axios from 'axios';
import { LoadScript, GoogleMap, Marker } from '@react-google-maps/api';

// Define our complete Lead type, including relations
type LeadWithDetails = Schema['Lead']['type'] & {
  contacts: Schema['Contact']['type'][];
  enrichments: Schema['Enrichment']['type'][];
  activities: Schema['Activity']['type'][];
};

// 2. Define the API response type
type LeadApiResponse = {
  success: boolean;
  lead: LeadWithDetails;
};

// 3. Create an axios instance
const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Define Google Maps libraries
const libraries: 'places'[] = ['places'];

// Define the map container style
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginTop: '1.5rem',
};

export default function LeadDetailPage() {
  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();

  useEffect(() => {
    const id = params.id as string;
    if (id) {
      fetchLead(id);
    }
  }, [params.id]);

  const fetchLead = async (id: string) => {
    setIsLoading(true);
    try {
      // Use axiosInstance and the correct response type
      const response = await axiosInstance.get<LeadApiResponse>(`/leads/${id}`);
      const data = response.data; // axios puts the JSON in 'response.data'

      if (!data.success) {
        throw new Error('Failed to fetch lead data.');
      }
      setLead(data.lead);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6 text-center'>
        <Loader size='large' />
      </main>
    );
  }

  if (error) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold text-red-600'>Error</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className='max-w-4xl mx-auto py-10 px-6'>
        <h1 className='text-3xl font-bold'>Lead Not Found</h1>
      </main>
    );
  }

  // Define the map center using the fields from the lead object
  const mapCenter =
    lead.latitude && lead.longitude
      ? { lat: lead.latitude, lng: lead.longitude }
      : null;

  return (
    <main className='max-w-4xl mx-auto py-10 px-6'>
      {/* --- Header --- */}
      <h1 className='text-3xl font-bold'>
        {lead.ownerFirstName} {lead.ownerLastName}
      </h1>
      <p className='text-lg text-gray-600'>
        {lead.ownerAddress}, {lead.ownerCity}, {lead.ownerState}
      </p>

      {/* --- Lead Details Card --- */}
      <div className='mt-6 bg-white shadow border rounded-lg p-6'>
        <h2 className='text-xl font-semibold mb-4'>Property Details</h2>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='text-sm font-medium text-gray-500'>Type</label>
            <p className='text-base'>{lead.type}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-gray-500'>Status</label>
            <p className='text-base'>{lead.skipTraceStatus}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-gray-500'>
              Year Built
            </label>
            <p className='text-base'>{lead.yearBuilt || 'N/A'}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-gray-500'>Sq. Ft.</label>
            <p className='text-base'>{lead.squareFeet || 'N/A'}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-gray-500'>
              Bedrooms
            </label>
            <p className='text-base'>{lead.bedrooms || 'N/A'}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-gray-500'>
              Bathrooms
            </label>
            <p className='text-base'>{lead.baths || 'N/A'}</p>
          </div>
        </div>

        {lead.type === 'probate' && (
          <>
            <h3 className='text-lg font-semibold mt-6 mb-2'>Executor Info</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Name
                </label>
                <p className='text-base'>
                  {lead.adminFirstName} {lead.adminLastName}
                </p>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-500'>
                  Mailing Address
                </label>
                <p className='text-base'>{lead.adminAddress || 'N/A'}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- Contacts Card --- */}
      <div className='mt-6 bg-white shadow border rounded-lg p-6'>
        <h2 className='text-xl font-semibold mb-4'>Contacts</h2>
        {lead.contacts?.length === 0 ? (
          <p className='text-gray-500'>No skip-trace contacts found.</p>
        ) : (
          lead.contacts.map((contact) => (
            <div key={contact.id} className='border-b py-2'>
              <p className='font-medium'>
                {contact.firstName} {contact.lastName} ({contact.role})
              </p>
              <p className='text-sm text-gray-600'>
                Phones: {contact.phones?.length || 0}
              </p>
              <p className='text-sm text-gray-600'>
                Emails: {contact.emails?.length || 0}
              </p>
            </div>
          ))
        )}
      </div>

      {/* --- 👇 NEW: Activities Card 👇 --- */}
      <div className='bg-white shadow border rounded-lg p-6'>
        <h2 className='text-xl font-semibold mb-4'>Activity</h2>
        {lead.activities?.length === 0 ? (
          <p className='text-gray-500'>No activities logged.</p>
        ) : (
          lead.activities?.map((activity) => (
            <div key={activity.id} className='border-b py-2'>
              <p className='font-medium capitalize'>{activity.type}</p>
              <p className='text-sm text-gray-600'>
                Outcome: {activity.outcome}
              </p>
              <p className='text-sm text-gray-400'>
                {new Date(Number(activity.createdAt)).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* --- Right Column (Map & Enrichments) --- */}
      <div className='space-y-6'>
        {/* --- 👇 NEW: Map Card 👇 --- */}
        <div className='bg-white shadow border rounded-lg p-6'>
          <h2 className='text-xl font-semibold mb-4'>Map</h2>
          {mapCenter ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={16}
            >
              <Marker position={mapCenter} />
            </GoogleMap>
          ) : (
            <p className='text-gray-500'>Address not geocoded.</p>
          )}
        </div>

        {/* --- 👇 NEW: Enrichments Card 👇 --- */}
        <div className='bg-white shadow border rounded-lg p-6'>
          <h2 className='text-xl font-semibold mb-4'>Data Log</h2>
          {lead.enrichments?.length === 0 ? (
            <p className='text-gray-500'>No enrichments found.</p>
          ) : (
            <div className='space-y-2'>
              {lead.enrichments?.map((enrichment) => (
                <div key={enrichment.id} className='text-xs'>
                  <p className='font-medium'>{enrichment.source}</p>
                  <p className='text-gray-500'>
                    Status: {enrichment.statusText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- Future Edit/Action Buttons Here --- */}
    </main>
  );
}
