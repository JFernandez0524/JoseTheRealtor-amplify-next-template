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
  snoozedUntil?: string;
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

const isActivelySnoozed = (lead: { snoozedUntil?: string }) =>
  !!lead.snoozedUntil && new Date(lead.snoozedUntil) > new Date();

const formatSnoozeDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
  const [sortBy, setSortBy] = useState<'default' | 'city-asc' | 'city-desc' | 'priority' | 'name' | 'status'>('default');
  const [noteInput, setNoteInput] = useState('');

  // Route optimization state
  const [selectedForRoute, setSelectedForRoute] = useState<Set<string>>(new Set());
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [routeOrder, setRouteOrder] = useState<string[]>([]);
  const [routeSummary, setRouteSummary] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [snoozeLeadId, setSnoozeLeadId] = useState<string | null>(null);
  const [showSnoozed, setShowSnoozed] = useState(false);

  useEffect(() => {
    fetchDoorKnockLeads();
  }, []);

  // Pre-fill note input when a lead is selected
  useEffect(() => {
    setNoteInput(selectedLead?.notes || '');
  }, [selectedLead?.id]);

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

  // --- Hot lead & snooze ---
  const toggleHotLead = useCallback(async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const newPriority = lead.priority === 'HIGH' ? 'MEDIUM' : 'HIGH';
    setLeads(curr => curr.map(l => l.id === leadId ? { ...l, priority: newPriority } : l));
    setSelectedLead(curr => curr?.id === leadId ? { ...curr, priority: newPriority } : curr);
    try {
      const res = await fetch('/api/v1/update-door-knock-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, priority: newPriority }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setLeads(curr => curr.map(l => l.id === leadId ? { ...l, priority: lead.priority } : l));
      setSelectedLead(curr => curr?.id === leadId ? { ...curr, priority: lead.priority } : curr);
      alert('Failed to update priority. Please try again.');
    }
  }, [leads]);

  const snoozeLead = useCallback(async (leadId: string, until: string | null) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    setLeads(curr => curr.map(l => l.id === leadId ? { ...l, snoozedUntil: until ?? undefined } : l));
    setSelectedLead(curr => curr?.id === leadId ? { ...curr, snoozedUntil: until ?? undefined } : curr);
    try {
      const res = await fetch('/api/v1/update-door-knock-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, snoozedUntil: until }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setLeads(curr => curr.map(l => l.id === leadId ? { ...l, snoozedUntil: lead.snoozedUntil } : l));
      setSelectedLead(curr => curr?.id === leadId ? { ...curr, snoozedUntil: lead.snoozedUntil } : curr);
      alert('Failed to snooze lead. Please try again.');
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
    setCurrentLocation(null);
  };

  const optimizeRoute = useCallback(async () => {
    const selected = leads.filter(l => selectedForRoute.has(l.id) && l.latitude && l.longitude);
    const minStops = useCurrentLocation ? 1 : 2;
    if (selected.length < minStops) {
      alert(useCurrentLocation ? 'Select at least 1 lead to optimize a route.' : 'Select at least 2 leads to optimize a route.');
      return;
    }
    if (selected.length > 25) { alert('Google Maps supports up to 25 stops. Please deselect some leads.'); return; }

    setOptimizing(true);
    try {
      let origin: google.maps.LatLngLiteral;
      let stops: typeof selected;

      if (useCurrentLocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(origin);
        setMapCenter(origin);
        stops = selected;
      } else {
        origin = { lat: selected[0].latitude!, lng: selected[0].longitude! };
        stops = selected.slice(1);
      }

      const service = new google.maps.DirectionsService();
      const destination = { lat: stops[stops.length - 1].latitude!, lng: stops[stops.length - 1].longitude! };
      const waypoints = stops.slice(0, -1).map(l => ({
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

      const waypointOrder = result.routes[0].waypoint_order;
      const middleStops = stops.slice(0, -1);
      const ordered = useCurrentLocation
        ? [
            ...waypointOrder.map((i: number) => middleStops[i].id),
            stops[stops.length - 1].id,
          ]
        : [
            selected[0].id,
            ...waypointOrder.map((i: number) => middleStops[i].id),
            stops[stops.length - 1].id,
          ];
      setRouteOrder(ordered);

      const legs = result.routes[0].legs;
      const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
      const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
      const mins = Math.round(totalSeconds / 60);
      const miles = (totalMeters / 1609.34).toFixed(1);
      setRouteSummary(`${mins} min • ${miles} mi`);
    } catch (error: any) {
      if (error?.code === 1) {
        alert('Location access denied. Please enable location permissions in your browser and try again.');
      } else {
        console.error('Route optimization failed:', error);
        // Surface the Google DirectionsStatus (e.g. REQUEST_DENIED, ZERO_RESULTS)
        // so failures are diagnosable from a phone without devtools.
        const status = error?.code || error?.message;
        alert(`Failed to optimize route${status ? ` (${status})` : ''}. Please try again.`);
      }
    } finally {
      setOptimizing(false);
    }
  }, [leads, selectedForRoute, useCurrentLocation]);

  // --- Google Maps navigation URLs (Task 7) ---
  const getNavigateUrl = (lead: DoorKnockLead) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;

  const getFullRouteUrl = () => {
    const ordered = routeOrder.map(id => leads.find(l => l.id === id)).filter(Boolean) as DoorKnockLead[];
    if (useCurrentLocation && currentLocation) {
      if (ordered.length < 1) return '';
      const points = ordered.map(l => `${l.latitude},${l.longitude}`);
      return `https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${points.join('/')}`;
    }
    if (ordered.length < 2) return '';
    const points = ordered.map(l => `${l.latitude},${l.longitude}`);
    return `https://www.google.com/maps/dir/${points.join('/')}`;
  };

  // --- Filtering & ordering ---
  const snoozedCount = useMemo(() => leads.filter(isActivelySnoozed).length, [leads]);

  const filteredLeads = useMemo(() => {
    let result = statusFilter === 'ALL' ? leads : leads.filter(l => l.status === statusFilter);
    if (!showSnoozed) result = result.filter(l => !isActivelySnoozed(l));

    // Route order takes precedence over manual sort
    if (routeOrder.length > 0) {
      const orderMap = new Map(routeOrder.map((id, i) => [id, i]));
      return [...result].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }

    const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const statusRank: Record<string, number> = { PENDING: 0, VISITED: 1, NOT_HOME: 2, COMPLETED: 3 };

    switch (sortBy) {
      case 'city-asc':  return [...result].sort((a, b) => (a.propertyCity || '').localeCompare(b.propertyCity || ''));
      case 'city-desc': return [...result].sort((a, b) => (b.propertyCity || '').localeCompare(a.propertyCity || ''));
      case 'priority':  return [...result].sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1));
      case 'name':      return [...result].sort((a, b) => a.ownerName.localeCompare(b.ownerName));
      case 'status':    return [...result].sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9));
      default:          return result;
    }
  }, [leads, statusFilter, routeOrder, showSnoozed, sortBy]);

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

  // --- Today's trip leads ---
  const todayStr = new Date().toLocaleDateString();
  const tripLeads = useMemo(() =>
    leads
      .filter(l => l.visitedAt && new Date(l.visitedAt).toLocaleDateString() === todayStr)
      .sort((a, b) => new Date(a.visitedAt!).getTime() - new Date(b.visitedAt!).getTime()),
    [leads, todayStr]
  );

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTripSummary(true)}
              className="relative px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
            >
              🗒️ Trip Summary
              {tripLeads.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {tripLeads.length}
                </span>
              )}
            </button>
            <button onClick={exportToGoogleMaps} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
              📍 Export CSV
            </button>
          </div>
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
              <div className="flex gap-1.5">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="flex-1 px-2 py-1.5 border rounded text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="VISITED">Visited</option>
                  <option value="NOT_HOME">Not Home</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 px-2 py-1.5 border rounded text-sm"
                >
                  <option value="default">Sort: Default</option>
                  <option value="city-asc">City A→Z</option>
                  <option value="city-desc">City Z→A</option>
                  <option value="priority">Priority</option>
                  <option value="name">Name A→Z</option>
                  <option value="status">Status</option>
                </select>
              </div>

              {snoozedCount > 0 && (
                <button
                  onClick={() => setShowSnoozed(v => !v)}
                  className={`w-full px-2 py-1.5 text-xs rounded border transition-colors ${
                    showSnoozed
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  ❄️ {showSnoozed ? `Hiding snoozed (${snoozedCount})` : `Show snoozed (${snoozedCount})`}
                </button>
              )}

              {/* Route controls */}
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={selectAllPending} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                  Select All Pending
                </button>
                <span className="text-xs text-gray-500">{selectedForRoute.size}/25</span>
              </div>
              <button
                onClick={() => setUseCurrentLocation(v => !v)}
                className={`w-full px-2 py-1.5 text-xs rounded border transition-colors ${
                  useCurrentLocation
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                📍 {useCurrentLocation ? 'Starting from my location ✓' : 'Start from my current location'}
              </button>
              <div className="flex gap-1">
                <button
                  onClick={optimizeRoute}
                  disabled={selectedForRoute.size < (useCurrentLocation ? 1 : 2) || optimizing}
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
                        {isActivelySnoozed(lead) && (
                          <p className="text-[10px] text-blue-500 mt-0.5">❄️ Snoozed until {formatSnoozeDate(lead.snoozedUntil!)}</p>
                        )}

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

                        {/* Hot Lead / Snooze — large touch targets for mobile */}
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={e => { e.stopPropagation(); toggleHotLead(lead.id); }}
                            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg active:scale-95 transition-transform ${
                              lead.priority === 'HIGH'
                                ? 'bg-red-500 text-white'
                                : 'bg-red-50 text-red-600 border border-red-200'
                            }`}
                          >
                            🔥 {lead.priority === 'HIGH' ? 'Hot!' : 'Hot Lead'}
                          </button>

                          {snoozeLeadId === lead.id ? (
                            <div className="flex-1 flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                className="flex-1 px-1.5 py-2 border rounded-lg text-xs"
                                autoFocus
                                onChange={e => {
                                  if (e.target.value) {
                                    snoozeLead(lead.id, e.target.value);
                                    setSnoozeLeadId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={e => { e.stopPropagation(); setSnoozeLeadId(null); }}
                                className="p-1 text-gray-400 hover:text-gray-600 text-base"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                if (isActivelySnoozed(lead)) {
                                  snoozeLead(lead.id, null);
                                } else {
                                  setSnoozeLeadId(lead.id);
                                }
                              }}
                              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg active:scale-95 transition-transform ${
                                isActivelySnoozed(lead)
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200'
                              }`}
                            >
                              {isActivelySnoozed(lead)
                                ? `❄️ ${formatSnoozeDate(lead.snoozedUntil!)}`
                                : '❄️ Snooze'}
                            </button>
                          )}
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

                {currentLocation && (
                  <Marker
                    position={currentLocation}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: '#2563eb',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 3,
                    }}
                    title="Your location"
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
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Add a note..."
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 px-2 py-1 border rounded text-xs"
                            onKeyDown={e => {
                              if (e.key === 'Enter' && noteInput.trim()) {
                                updateLeadStatus(selectedLead.id, selectedLead.status, noteInput.trim());
                              }
                            }}
                          />
                          <button
                            onClick={() => updateLeadStatus(selectedLead.id, selectedLead.status, noteInput || undefined)}
                            className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 whitespace-nowrap"
                          >
                            Save
                          </button>
                        </div>
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

                      {/* Hot Lead / Snooze in InfoWindow */}
                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        <button
                          onClick={() => toggleHotLead(selectedLead.id)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg ${
                            selectedLead.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}
                        >
                          🔥 {selectedLead.priority === 'HIGH' ? 'Hot!' : 'Hot Lead'}
                        </button>
                        <button
                          onClick={() => {
                            if (isActivelySnoozed(selectedLead)) {
                              snoozeLead(selectedLead.id, null);
                            } else {
                              const date = prompt('Snooze until (YYYY-MM-DD):', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
                              if (date) snoozeLead(selectedLead.id, date);
                            }
                          }}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg ${
                            isActivelySnoozed(selectedLead)
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {isActivelySnoozed(selectedLead)
                            ? `❄️ ${formatSnoozeDate(selectedLead.snoozedUntil!)}`
                            : '❄️ Snooze'}
                        </button>
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

      {/* Trip Summary Modal */}
      {showTripSummary && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">Today's Trip</h2>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setShowTripSummary(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tripLeads.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-3xl mb-2">🚶</p>
                  <p className="text-sm text-gray-500">No stops logged yet today.</p>
                  <p className="text-xs text-gray-400 mt-1">Mark leads as Visited, Not Home, or Completed to track your trip.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {tripLeads.map((lead, idx) => (
                    <li key={lead.id} className="flex gap-3">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                          lead.status === 'COMPLETED' ? 'bg-green-500' :
                          lead.status === 'VISITED' ? 'bg-blue-500' :
                          lead.status === 'NOT_HOME' ? 'bg-orange-400' : 'bg-gray-300'
                        }`} />
                        {idx < tripLeads.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      {/* Content */}
                      <div className="pb-3 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{lead.ownerName}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(lead.visitedAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{lead.propertyAddress}, {lead.propertyCity}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass[lead.status]}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                        {lead.notes && (
                          <p className="mt-1 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">📝 {lead.notes}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {tripLeads.length > 0 && (
              <div className="px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{tripLeads.filter(l => l.status === 'VISITED').length} visited</span>
                  <span>{tripLeads.filter(l => l.status === 'NOT_HOME').length} not home</span>
                  <span>{tripLeads.filter(l => l.status === 'COMPLETED').length} completed</span>
                  <span className="font-semibold text-gray-800">{tripLeads.length} total</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
