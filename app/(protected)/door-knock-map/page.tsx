'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps } from '@/app/components/GoogleMapsProvider';

const defaultCenter = { lat: 40.7128, lng: -74.0060 };

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

type StatusFilter = 'ALL' | DoorKnockLead['status'];

const statusColors: Record<string, string> = {
  COMPLETED: '#22c55e',
  VISITED: '#3b82f6',
  NOT_HOME: '#f59e0b',
  HIGH: '#ef4444',
  DEFAULT: '#6b7280',
};

const getMarkerColor = (status: string, priority: string) =>
  statusColors[status] || (priority === 'HIGH' ? statusColors.HIGH : statusColors.DEFAULT);

const statusBadgeClass: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  VISITED: 'bg-blue-100 text-blue-800',
  NOT_HOME: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

const priorityBadgeClass: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
};

export default function DoorKnockMapPage() {
  const { isLoaded } = useGoogleMaps();
  const [leads, setLeads] = useState<DoorKnockLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<DoorKnockLead | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [noteInput, setNoteInput] = useState('');

  // Route optimization state
  const [selectedForRoute, setSelectedForRoute] = useState<Set<string>>(new Set());
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [routeOrder, setRouteOrder] = useState<string[]>([]);
  const [routeSummary, setRouteSummary] = useState('');
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    fetchDoorKnockLeads();
  }, []);

  const fetchDoorKnockLeads = async () => {
    try {
      const response = await fetch('/api/v1/door-knock-leads');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        if (data.leads?.length > 0) {
          const first = data.leads.find((l: DoorKnockLead) => l.latitude && l.longitude);
          if (first) setMapCenter({ lat: first.latitude!, lng: first.longitude! });
        }
      }
    } catch (error) {
      console.error('Error fetching door knock leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Persistent status update (Task 3) ---
  const updateLeadStatus = useCallback(async (leadId: string, status: DoorKnockLead['status'], notes?: string) => {
    const prev = leads.find(l => l.id === leadId);
    // Optimistic update
    setLeads(curr => curr.map(l =>
      l.id === leadId ? { ...l, status, notes: notes ?? l.notes, visitedAt: new Date().toISOString() } : l
    ));
    // Update selectedLead if it's the one being changed
    setSelectedLead(curr => curr?.id === leadId ? { ...curr, status, notes: notes ?? curr.notes, visitedAt: new Date().toISOString() } : curr);

    try {
      const res = await fetch('/api/v1/update-door-knock-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status, notes }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Revert on failure
      if (prev) {
        setLeads(curr => curr.map(l => l.id === leadId ? prev : l));
        setSelectedLead(curr => curr?.id === leadId ? prev : curr);
      }
      alert('Failed to update status. Please try again.');
    }
  }, [leads]);

  // --- Remove lead (Task 2/4) ---
  const removeLead = useCallback(async (leadId: string) => {
    if (!confirm('Remove this lead from the door knock queue?')) return;
    const prev = leads;
    setLeads(curr => curr.filter(l => l.id !== leadId));
    setSelectedLead(curr => curr?.id === leadId ? null : curr);
    setSelectedForRoute(curr => { const n = new Set(curr); n.delete(leadId); return n; });

    try {
      const res = await fetch('/api/v1/remove-door-knock', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setLeads(prev);
      alert('Failed to remove lead. Please try again.');
    }
  }, [leads]);

  // --- Route optimization (Task 6) ---
  const toggleRouteSelection = (id: string) => {
    setSelectedForRoute(curr => {
      const n = new Set(curr);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllPending = () => {
    const pendingIds = filteredLeads.filter(l => l.status === 'PENDING' && l.latitude && l.longitude).map(l => l.id);
    setSelectedForRoute(new Set(pendingIds));
  };

  const clearRoute = () => {
    setDirectionsResult(null);
    setRouteOrder([]);
    setRouteSummary('');
    setSelectedForRoute(new Set());
  };

  const optimizeRoute = useCallback(async () => {
    const selected = leads.filter(l => selectedForRoute.has(l.id) && l.latitude && l.longitude);
    if (selected.length < 2) { alert('Select at least 2 leads to optimize a route.'); return; }
    if (selected.length > 25) { alert('Google Maps supports up to 25 stops. Please deselect some leads.'); return; }

    setOptimizing(true);
    try {
      const service = new google.maps.DirectionsService();
      const origin = { lat: selected[0].latitude!, lng: selected[0].longitude! };
      const destination = { lat: selected[selected.length - 1].latitude!, lng: selected[selected.length - 1].longitude! };
      const waypoints = selected.slice(1, -1).map(l => ({
        location: { lat: l.latitude!, lng: l.longitude! },
        stopover: true,
      }));

      const result = await service.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setDirectionsResult(result);

      // Reorder leads based on optimized waypoint_order
      const waypointOrder = result.routes[0].waypoint_order;
      const middleLeads = selected.slice(1, -1);
      const ordered = [
        selected[0].id,
        ...waypointOrder.map((i: number) => middleLeads[i].id),
        selected[selected.length - 1].id,
      ];
      setRouteOrder(ordered);

      // Calculate total time and distance
      const legs = result.routes[0].legs;
      const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
      const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
      const mins = Math.round(totalSeconds / 60);
      const miles = (totalMeters / 1609.34).toFixed(1);
      setRouteSummary(`${mins} min • ${miles} mi`);
    } catch (error) {
      console.error('Route optimization failed:', error);
      alert('Failed to optimize route. Please try again.');
    } finally {
      setOptimizing(false);
    }
  }, [leads, selectedForRoute]);

  // --- Google Maps navigation URLs (Task 7) ---
  const getNavigateUrl = (lead: DoorKnockLead) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;

  const getFullRouteUrl = () => {
    const ordered = routeOrder.map(id => leads.find(l => l.id === id)).filter(Boolean) as DoorKnockLead[];
    if (ordered.length < 2) return '';
    const points = ordered.map(l => `${l.latitude},${l.longitude}`);
    return `https://www.google.com/maps/dir/${points.join('/')}`;
  };

  // --- Filtering & ordering ---
  const filteredLeads = useMemo(() => {
    let result = statusFilter === 'ALL' ? leads : leads.filter(l => l.status === statusFilter);
    // If route is active, sort by route order
    if (routeOrder.length > 0) {
      const orderMap = new Map(routeOrder.map((id, i) => [id, i]));
      result = [...result].sort((a, b) => {
        const ai = orderMap.get(a.id) ?? 999;
        const bi = orderMap.get(b.id) ?? 999;
        return ai - bi;
      });
    }
    return result;
  }, [leads, statusFilter, routeOrder]);

  // --- CSV Export ---
  const exportToGoogleMaps = () => {
    if (leads.length === 0) return;
    const headers = ['Name', 'Address', 'Description', 'Priority', 'Status', 'Lead Type', 'Property Value', 'Notes', 'Latitude', 'Longitude'];
    const rows = leads.map(lead => [
      lead.ownerName,
      `${lead.propertyAddress}, ${lead.propertyCity}, ${lead.propertyState} ${lead.propertyZip}`,
      `${lead.leadType || 'Lead'} - $${lead.estimatedValue?.toLocaleString() || 'Unknown'} - ${lead.status}`,
      lead.priority, lead.status, lead.leadType || '', lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '',
      lead.notes || '', String(lead.latitude || ''), String(lead.longitude || ''),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `door-knock-leads-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Click sidebar lead → center map ---
  const focusLead = (lead: DoorKnockLead) => {
    if (lead.latitude && lead.longitude) {
      setMapCenter({ lat: lead.latitude, lng: lead.longitude });
    }
    setSelectedLead(lead);
  };

  // --- Stats ---
  const stats = useMemo(() => ({
    total: leads.length,
    pending: leads.filter(l => l.status === 'PENDING').length,
    visited: leads.filter(l => l.status === 'VISITED').length,
    completed: leads.filter(l => l.status === 'COMPLETED').length,
  }), [leads]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading door knock map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🚪 Door Knock Map</h1>
            <p className="text-sm text-gray-600">Plan and track your door knocking visits</p>
          </div>
          <button onClick={exportToGoogleMaps} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            📍 Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-red-600' },
            { label: 'Visited', value: stats.visited, color: 'text-blue-600' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg shadow p-3">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-600">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Sidebar + Map */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow flex flex-col overflow-hidden">
            {/* Sidebar header */}
            <div className="p-3 border-b space-y-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="VISITED">Visited</option>
                <option value="NOT_HOME">Not Home</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {/* Route controls */}
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={selectAllPending} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                  Select All Pending
                </button>
                <span className="text-xs text-gray-500">{selectedForRoute.size}/25</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={optimizeRoute}
                  disabled={selectedForRoute.size < 2 || optimizing}
                  className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {optimizing ? '⏳ Optimizing...' : '🗺️ Optimize Route'}
                </button>
                {directionsResult && (
                  <button onClick={clearRoute} className="px-2 py-1.5 text-xs bg-gray-200 rounded hover:bg-gray-300">
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Route summary + Start Route button */}
              {routeSummary && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-700">🚗 {routeSummary}</span>
                  <a
                    href={getFullRouteUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    🚗 Start Route
                  </a>
                </div>
              )}
            </div>

            {/* Lead list */}
            <div className="flex-1 overflow-y-auto">
              {filteredLeads.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No leads found</div>
              ) : (
                filteredLeads.map((lead, idx) => (
                  <div
                    key={lead.id}
                    className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${selectedLead?.id === lead.id ? 'bg-blue-50' : ''}`}
                    onClick={() => focusLead(lead)}
                  >
                    <div className="flex items-start gap-2">
                      {/* Route checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedForRoute.has(lead.id)}
                        onChange={e => { e.stopPropagation(); toggleRouteSelection(lead.id); }}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {routeOrder.length > 0 && routeOrder.includes(lead.id) && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs mr-1">
                                {routeOrder.indexOf(lead.id) + 1}
                              </span>
                            )}
                            {lead.ownerName}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); removeLead(lead.id); }}
                            className="text-red-400 hover:text-red-600 text-xs ml-1 flex-shrink-0"
                            title="Remove from queue"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{lead.propertyAddress}, {lead.propertyCity}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass[lead.status]}`}>
                            {lead.status.replace('_', ' ')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityBadgeClass[lead.priority]}`}>
                            {lead.priority}
                          </span>
                          {lead.estimatedValue ? (
                            <span className="text-[10px] text-gray-500">${lead.estimatedValue.toLocaleString()}</span>
                          ) : null}
                        </div>
                        {lead.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate">📝 {lead.notes}</p>}

                        {/* Quick actions */}
                        <div className="flex items-center gap-1 mt-1.5">
                          {lead.status !== 'VISITED' && (
                            <button onClick={e => { e.stopPropagation(); updateLeadStatus(lead.id, 'VISITED'); }}
                              className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded hover:bg-blue-200">Visited</button>
                          )}
                          {lead.status !== 'NOT_HOME' && (
                            <button onClick={e => { e.stopPropagation(); updateLeadStatus(lead.id, 'NOT_HOME'); }}
                              className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded hover:bg-orange-200">Not Home</button>
                          )}
                          {lead.status !== 'COMPLETED' && (
                            <button onClick={e => { e.stopPropagation(); updateLeadStatus(lead.id, 'COMPLETED'); }}
                              className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded hover:bg-green-200">Done</button>
                          )}
                          <a
                            href={getNavigateUrl(lead)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded hover:bg-gray-200"
                          >
                            📍 Nav
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={12}
              >
                {/* Route polyline */}
                {directionsResult && (
                  <DirectionsRenderer
                    directions={directionsResult}
                    options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.7 } }}
                  />
                )}

                {leads.map(lead => (
                  <Marker
                    key={lead.id}
                    position={{ lat: lead.latitude || 0, lng: lead.longitude || 0 }}
                    onClick={() => setSelectedLead(lead)}
                    label={routeOrder.includes(lead.id) ? {
                      text: String(routeOrder.indexOf(lead.id) + 1),
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    } : undefined}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: routeOrder.includes(lead.id) ? 14 : 8,
                      fillColor: getMarkerColor(lead.status, lead.priority),
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }}
                  />
                ))}

                {selectedLead && (
                  <InfoWindow
                    position={{ lat: selectedLead.latitude || 0, lng: selectedLead.longitude || 0 }}
                    onCloseClick={() => setSelectedLead(null)}
                  >
                    <div className="p-1 max-w-xs">
                      <h3 className="font-semibold text-gray-900 text-sm">{selectedLead.ownerName}</h3>
                      <p className="text-xs text-gray-600">
                        {selectedLead.propertyAddress}<br />
                        {selectedLead.propertyCity}, {selectedLead.propertyState} {selectedLead.propertyZip}
                      </p>

                      <div className="flex items-center gap-1 my-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass[selectedLead.status]}`}>
                          {selectedLead.status.replace('_', ' ')}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityBadgeClass[selectedLead.priority]}`}>
                          {selectedLead.priority}
                        </span>
                      </div>

                      {selectedLead.estimatedValue && (
                        <p className="text-xs text-gray-600">Value: ${selectedLead.estimatedValue.toLocaleString()}</p>
                      )}

                      {selectedLead.notes && (
                        <p className="text-xs text-gray-500 mt-1">📝 {selectedLead.notes}</p>
                      )}

                      {/* Notes input */}
                      <div className="mt-1.5">
                        <input
                          type="text"
                          placeholder="Add a note..."
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full px-2 py-1 border rounded text-xs"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && noteInput.trim()) {
                              updateLeadStatus(selectedLead.id, selectedLead.status, noteInput.trim());
                              setNoteInput('');
                            }
                          }}
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        <button onClick={() => updateLeadStatus(selectedLead.id, 'VISITED', noteInput || undefined)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Visited</button>
                        <button onClick={() => updateLeadStatus(selectedLead.id, 'NOT_HOME', noteInput || undefined)}
                          className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700">Not Home</button>
                        <button onClick={() => updateLeadStatus(selectedLead.id, 'COMPLETED', noteInput || undefined)}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Complete</button>
                      </div>
                      <div className="flex justify-between items-center mt-1.5">
                        <a href={getNavigateUrl(selectedLead)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline">📍 Navigate</a>
                        <button onClick={() => removeLead(selectedLead.id)}
                          className="text-xs text-red-500 hover:text-red-700">✕ Remove</button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100">
                <div className="text-gray-500">Loading map...</div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 bg-white rounded-lg shadow p-3">
          <div className="flex flex-wrap gap-4 text-xs">
            {[
              { color: 'bg-gray-500', label: 'Pending' },
              { color: 'bg-red-500', label: 'High Priority' },
              { color: 'bg-orange-500', label: 'Not Home' },
              { color: 'bg-blue-500', label: 'Visited' },
              { color: 'bg-green-500', label: 'Completed' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
