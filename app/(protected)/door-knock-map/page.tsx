'use client';

import { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/data';
import { cookies } from 'next/headers';
import config from '@/amplify_outputs.json';

const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060 // Default to NYC, will be updated based on leads
};

interface DoorKnockLead {
  id: string;
  ownerName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip?: string;
  latitude?: number;
  longitude?: number;
  status: 'PENDING' | 'VISITED' | 'NOT_HOME' | 'COMPLETED';
  leadType?: string;
  estimatedValue?: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
  visitedAt?: string;
}

export default function DoorKnockMapPage() {
  const [leads, setLeads] = useState<DoorKnockLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<DoorKnockLead | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoorKnockLeads();
  }, []);

  const fetchDoorKnockLeads = async () => {
    try {
      // This will be implemented to fetch from DoorKnockQueue table
      setLoading(false);
    } catch (error) {
      console.error('Error fetching door knock leads:', error);
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: DoorKnockLead['status'], notes?: string) => {
    try {
      // Update lead status in database
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, status, notes, visitedAt: new Date().toISOString() }
          : lead
      ));
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const getMarkerColor = (status: string, priority: string) => {
    if (status === 'COMPLETED') return '#22c55e'; // Green
    if (status === 'VISITED') return '#3b82f6'; // Blue
    if (status === 'NOT_HOME') return '#f59e0b'; // Orange
    if (priority === 'HIGH') return '#ef4444'; // Red
    return '#6b7280'; // Gray
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading door knock map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Door Knock Map</h1>
          <p className="mt-2 text-gray-600">Plan and track your door knocking visits</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
            <div className="text-sm text-gray-600">Total Leads</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-600">
              {leads.filter(l => l.status === 'PENDING').length}
            </div>
            <div className="text-sm text-gray-600">Pending Visits</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">
              {leads.filter(l => l.status === 'VISITED').length}
            </div>
            <div className="text-sm text-gray-600">Visited</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {leads.filter(l => l.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={12}
            >
              {leads.map((lead) => (
                <Marker
                  key={lead.id}
                  position={{
                    lat: lead.latitude || 0,
                    lng: lead.longitude || 0
                  }}
                  onClick={() => setSelectedLead(lead)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: getMarkerColor(lead.status, lead.priority),
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              ))}

              {selectedLead && (
                <InfoWindow
                  position={{
                    lat: selectedLead.latitude || 0,
                    lng: selectedLead.longitude || 0
                  }}
                  onCloseClick={() => setSelectedLead(null)}
                >
                  <div className="p-2 max-w-sm">
                    <h3 className="font-semibold text-gray-900">{selectedLead.ownerName}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedLead.propertyAddress}<br/>
                      {selectedLead.propertyCity}, {selectedLead.propertyState} {selectedLead.propertyZip}
                    </p>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedLead.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        selectedLead.status === 'VISITED' ? 'bg-blue-100 text-blue-800' :
                        selectedLead.status === 'NOT_HOME' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedLead.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedLead.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                        selectedLead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedLead.priority}
                      </span>
                    </div>

                    {selectedLead.estimatedValue && (
                      <p className="text-sm text-gray-600 mb-2">
                        Value: ${selectedLead.estimatedValue.toLocaleString()}
                      </p>
                    )}

                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => updateLeadStatus(selectedLead.id, 'VISITED')}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Mark Visited
                      </button>
                      <button
                        onClick={() => updateLeadStatus(selectedLead.id, 'NOT_HOME')}
                        className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                      >
                        Not Home
                      </button>
                      <button
                        onClick={() => updateLeadStatus(selectedLead.id, 'COMPLETED')}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Map Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-500"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <span>Not Home</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span>Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span>Completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
