import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const DriverRouteMap = dynamic(() => import('../../components/DriverRouteMap'), { ssr: false });

const NER_CITIES = [
  { name: 'Guwahati', lat: 26.1445, lng: 91.7362 },
  { name: 'Tezpur', lat: 26.6336, lng: 92.8004 },
  { name: 'Jorhat', lat: 26.7465, lng: 94.2026 },
  { name: 'Dibrugarh', lat: 27.4728, lng: 94.9120 },
  { name: 'Silchar', lat: 24.8333, lng: 92.7789 },
  { name: 'Itanagar', lat: 27.0844, lng: 93.6053 },
  { name: 'Shillong', lat: 25.5788, lng: 91.8933 },
  { name: 'Imphal', lat: 24.8170, lng: 93.9368 },
  { name: 'Kohima', lat: 25.6747, lng: 94.1086 },
  { name: 'Aizawl', lat: 23.7271, lng: 92.7176 },
  { name: 'Agartala', lat: 23.8315, lng: 91.2868 },
  { name: 'Gangtok', lat: 27.3389, lng: 88.6065 },
  { name: 'Nagaon', lat: 26.3503, lng: 92.6837 },
  { name: 'Lakhimpur', lat: 27.2368, lng: 94.1032 },
  { name: 'Goalpara', lat: 26.1736, lng: 90.6235 },
];

export interface FuelStation {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  fuels: string[];
  is_24x7: boolean;
  def_available: boolean;
  contact: string;
  distance_km?: number;
}

interface RouteData {
  segments: any[];
  total_risk: number;
  time_min: number;
  distance_km?: number;
  label?: string;
  corridors?: string[];
}

interface RouteComparison {
  route_a: RouteData;
  route_b: RouteData;
  comparison: {
    recommendation: string;
    reason: string;
    recommended_route?: string;
    time_diff_min?: number;
    risk_diff?: number;
  };
}

interface Incident {
  id: number;
  incident_type: string;
  severity: string | number;
  description: string;
  location: { lat: number; lng: number };
  created_at: string;
}

const STATIC_FALLBACK_FUEL_STATIONS: FuelStation[] = [
  {
    id: 'FS-GHY-01',
    name: 'Indian Oil COCO - Khanapara NH27',
    brand: 'Indian Oil',
    lat: 26.1158,
    lng: 91.8012,
    fuels: ['Diesel', 'Petrol', 'CNG'],
    is_24x7: true,
    def_available: true,
    contact: '+91 94350 12345',
    distance_km: 4.2,
  },
  {
    id: 'FS-GHY-02',
    name: 'BPCL Highway Oasis - Jalukbari',
    brand: 'Bharat Petroleum',
    lat: 26.1524,
    lng: 91.6621,
    fuels: ['Diesel', 'Petrol'],
    is_24x7: true,
    def_available: true,
    contact: '+91 94350 23456',
    distance_km: 7.8,
  },
  {
    id: 'FS-TEZ-01',
    name: 'Indian Oil - Mission Chariali NH15',
    brand: 'Indian Oil',
    lat: 26.6540,
    lng: 92.7915,
    fuels: ['Diesel', 'Petrol'],
    is_24x7: true,
    def_available: true,
    contact: '+91 94351 45678',
    distance_km: 18.5,
  },
  {
    id: 'FS-NAG-01',
    name: 'BPCL - Nagaon Bypass Point',
    brand: 'Bharat Petroleum',
    lat: 26.3450,
    lng: 92.6840,
    fuels: ['Diesel', 'Petrol', 'CNG'],
    is_24x7: true,
    def_available: true,
    contact: '+91 94352 67890',
    distance_km: 24.1,
  },
  {
    id: 'FS-SHL-01',
    name: 'Indian Oil Highway Pump - Barapani NH6',
    brand: 'Indian Oil',
    lat: 25.6620,
    lng: 91.9050,
    fuels: ['Diesel', 'Petrol'],
    is_24x7: true,
    def_available: true,
    contact: '+91 98620 11223',
    distance_km: 32.0,
  },
];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function getRiskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}

function getRiskEmoji(score: number): string {
  if (score >= 70) return '🔴';
  if (score >= 40) return '🟡';
  return '🟢';
}

export default function DriverPage() {
  const [originIdx, setOriginIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(1);
  const [routeData, setRouteData] = useState<RouteComparison | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [locationShared, setLocationShared] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [vehicleId] = useState(27);

  // Petrol pumps state
  const [showFuelPumps, setShowFuelPumps] = useState(false);
  const [fuelStations, setFuelStations] = useState<FuelStation[]>(STATIC_FALLBACK_FUEL_STATIONS);

  // Offline maps & low network state
  const [isOnline, setIsOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [routeSavedOffline, setRouteSavedOffline] = useState(false);
  const [offlineToast, setOfflineToast] = useState('');

  // Emergency SOS state
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosDisasterType, setSosDisasterType] = useState('LANDSLIDE');
  const [sosSeverity, setSosSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('CRITICAL');
  const [sosNotes, setSosNotes] = useState('');
  const [sosTransmitting, setSosTransmitting] = useState(false);
  const [sosResult, setSosResult] = useState<any>(null);
  const [pendingSosQueue, setPendingSosQueue] = useState<any[]>([]);

  const origin = NER_CITIES[originIdx];
  const destination = NER_CITIES[destIdx];

  const effectiveOffline = !isOnline || simulateOffline;

  // 1. Fetch Route with offline fallback
  const fetchRoute = useCallback(async () => {
    if (originIdx === destIdx) return;
    setLoadingRoute(true);
    setRouteError('');

    if (effectiveOffline) {
      // Try loading from offline cache
      const cached = localStorage.getItem('ner_driver_cached_route');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.routeData) {
            setRouteData(parsed.routeData);
            setOfflineToast('📦 Loaded pre-cached route for offline navigation.');
            setTimeout(() => setOfflineToast(''), 4000);
            setLoadingRoute(false);
            return;
          }
        } catch {}
      }
      setRouteError('Offline mode active and no pre-cached route found for this corridor.');
      setLoadingRoute(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: origin.lat,
          start_lng: origin.lng,
          end_lat: destination.lat,
          end_lng: destination.lng,
        }),
      });
      if (!res.ok) throw new Error(`Route API error: ${res.status}`);
      const data = await res.json();
      setRouteData(data);

      // Auto-cache active route
      try {
        localStorage.setItem('ner_driver_cached_route', JSON.stringify({
          routeData: data,
          origin,
          destination,
          savedAt: new Date().toISOString(),
        }));
        setRouteSavedOffline(true);
      } catch {}
    } catch (e: unknown) {
      // Fallback to cache on error
      const cached = localStorage.getItem('ner_driver_cached_route');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.routeData) {
            setRouteData(parsed.routeData);
            setOfflineToast('⚠️ Server unreachable. Loaded cached navigation route.');
            setTimeout(() => setOfflineToast(''), 4000);
            setLoadingRoute(false);
            return;
          }
        } catch {}
      }
      setRouteError(e instanceof Error ? e.message : 'Failed to fetch route.');
    } finally {
      setLoadingRoute(false);
    }
  }, [originIdx, destIdx, origin, destination, effectiveOffline]);

  // 2. Fetch Fuel Stations
  const fetchFuelStations = useCallback(async () => {
    if (effectiveOffline) return;
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/fuel-stations?lat=${origin.lat}&lng=${origin.lng}&radius_km=140`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFuelStations(data);
          localStorage.setItem('ner_cached_fuel_stations', JSON.stringify(data));
        }
      }
    } catch {
      const cached = localStorage.getItem('ner_cached_fuel_stations');
      if (cached) {
        try {
          setFuelStations(JSON.parse(cached));
        } catch {}
      }
    }
  }, [origin.lat, origin.lng, effectiveOffline]);

  // 3. Fetch Incidents
  const fetchIncidents = async () => {
    if (effectiveOffline) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`);
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      // Ignore
    }
  };

  // Sync any pending SOS reports when connection is restored
  const syncPendingSos = useCallback(async () => {
    const raw = localStorage.getItem('ner_pending_sos');
    if (!raw) return;
    try {
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining = [];
      for (const item of queue) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/sos/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (!res.ok) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem('ner_pending_sos', JSON.stringify(remaining));
      setPendingSosQueue(remaining);
      if (remaining.length === 0) {
        setOfflineToast('🚀 Offline SOS alerts successfully broadcasted to central dispatch!');
        setTimeout(() => setOfflineToast(''), 5000);
      }
    } catch {}
  }, []);

  // Online / Offline lifecycle detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingSos();
    };
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      const cached = localStorage.getItem('ner_driver_cached_route');
      if (cached) setRouteSavedOffline(true);

      const pendingSos = localStorage.getItem('ner_pending_sos');
      if (pendingSos) {
        try {
          setPendingSosQueue(JSON.parse(pendingSos));
        } catch {}
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [syncPendingSos]);

  useEffect(() => {
    fetchRoute();
    fetchIncidents();
    fetchFuelStations();
  }, [fetchRoute, fetchFuelStations]);

  // Save active route offline
  const saveRouteOffline = () => {
    if (!routeData) return;
    try {
      const packageData = {
        routeData,
        origin,
        destination,
        incidents,
        fuelStations,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('ner_driver_cached_route', JSON.stringify(packageData));
      setRouteSavedOffline(true);
      setOfflineToast('💾 Route & waypoint geometry cached offline! Available without cell coverage.');
      setTimeout(() => setOfflineToast(''), 4000);
    } catch {
      setOfflineToast('❌ Failed to cache route.');
      setTimeout(() => setOfflineToast(''), 4000);
    }
  };

  // Transmit Emergency SOS
  const transmitSos = async () => {
    setSosTransmitting(true);
    setSosResult(null);

    const payload = {
      driver_name: 'Driver Vikram Singh (TRK-27)',
      vehicle_id: vehicleId,
      lat: origin.lat,
      lng: origin.lng,
      disaster_type: sosDisasterType,
      severity: sosSeverity,
      description: sosNotes,
      radius_km: 60.0,
      timestamp: new Date().toISOString(),
    };

    if (effectiveOffline) {
      // Save in offline queue
      const updated = [...pendingSosQueue, payload];
      setPendingSosQueue(updated);
      localStorage.setItem('ner_pending_sos', JSON.stringify(updated));
      setSosResult({
        status: 'OFFLINE_QUEUED',
        disaster_type: sosDisasterType,
        driver_name: payload.driver_name,
        message: '📴 SOS logged in offline emergency queue. The system will auto-broadcast to all nearby logistics vehicles and central dispatch the instant network signal is detected!',
        alerted_vehicles_count: 0,
        alerted_vehicles: [],
      });
      setSosTransmitting(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/sos/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSosResult(data);
      fetchIncidents(); // Refresh hazard alerts
    } catch {
      const updated = [...pendingSosQueue, payload];
      setPendingSosQueue(updated);
      localStorage.setItem('ner_pending_sos', JSON.stringify(updated));
      setSosResult({
        status: 'OFFLINE_QUEUED',
        disaster_type: sosDisasterType,
        driver_name: payload.driver_name,
        message: '⚠️ Network timeout. SOS secured in offline memory and queued for auto-transmission.',
        alerted_vehicles_count: 0,
        alerted_vehicles: [],
      });
    } finally {
      setSosTransmitting(false);
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles/${vehicleId}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          setLocationShared(true);
          setLocationError('');
          setTimeout(() => setLocationShared(false), 5000);
        } catch {
          setLocationError('Failed to upload location to server.');
        }
      },
      (err) => setLocationError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  const getSeverityStyle = (severity: string | number) => {
    const s = String(severity ?? '').toUpperCase();
    if (s === 'HIGH' || s === '5' || s === '4') return 'bg-red-900/60 text-red-300 border-red-700';
    if (s === 'MEDIUM' || s === '3') return 'bg-yellow-900/60 text-yellow-300 border-yellow-700';
    return 'bg-green-900/60 text-green-300 border-green-700';
  };

  const isRouteBRecommended = Boolean(
    routeData?.comparison?.recommended_route === 'Route B' ||
    routeData?.comparison?.recommendation?.toLowerCase().includes('route b') ||
    (routeData && routeData.route_a.total_risk >= 50 && routeData.route_b.total_risk < routeData.route_a.total_risk)
  );

  const recommendedRoute = routeData ? (isRouteBRecommended ? routeData.route_b : routeData.route_a) : null;

  return (
    <>
      <Head>
        <title>Driver Portal — NER-SENTINEL</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-white pb-12">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
              <div className="w-px h-4 bg-gray-700" />
              <div className="text-sm">
                <span className="font-bold text-white">Truck #TRK-{vehicleId}</span>
                <span className="text-red-400 mx-2">|</span>
                <span className="text-red-400">💊 Critical Medicine</span>
                <span className="text-gray-500 mx-2">|</span>
                <span className="text-gray-300">{origin.name} → {destination.name}</span>
                {recommendedRoute && (
                  <>
                    <span className="text-gray-500 mx-2">|</span>
                    <span className="text-blue-400 font-semibold">
                      ETA: {formatTime(recommendedRoute.time_min)} ({isRouteBRecommended ? 'Route B' : 'Route A'})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons & Indicators */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Network Status Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  effectiveOffline
                    ? 'bg-yellow-950/80 border-yellow-700 text-yellow-300'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${effectiveOffline ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span>{effectiveOffline ? 'Low Network (Offline)' : 'Online'}</span>
              </div>

              {/* Simulate Low Network Toggle */}
              <button
                onClick={() => setSimulateOffline(prev => !prev)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                  simulateOffline
                    ? 'bg-amber-900/60 border-amber-600 text-amber-200 shadow'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
                title="Toggle simulated dead zone / low network area in the mountains"
              >
                {simulateOffline ? '📶 Normal Net' : '📴 Simulate Dead Zone'}
              </button>

              {/* Save Route Offline Button */}
              <button
                onClick={saveRouteOffline}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                  routeSavedOffline
                    ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                    : 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-300'
                }`}
                title="Save current route and waypoints to local storage for offline use"
              >
                {routeSavedOffline ? '💾 Route Cached' : '📥 Save Offline'}
              </button>

              {/* Share GPS Location */}
              <button
                onClick={shareLocation}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  locationShared
                    ? 'bg-green-700 text-green-100'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
              >
                {locationShared ? '✅ Location Shared' : '📍 Share GPS'}
              </button>

              {/* EMERGENCY SOS BUTTON */}
              <button
                onClick={() => {
                  setShowSosModal(true);
                  setSosResult(null);
                }}
                className="text-xs px-4 py-1.5 rounded-lg font-black bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-red-900/50 flex items-center gap-1.5 animate-pulse transition-all transform hover:scale-105"
              >
                <span className="text-base leading-none">🚨</span>
                <span>EMERGENCY SOS</span>
              </button>
            </div>
          </div>

          {locationError && (
            <div className="max-w-7xl mx-auto mt-2 text-red-400 text-xs bg-red-900/30 border border-red-800 px-3 py-1.5 rounded-lg">
              ⚠️ {locationError}
            </div>
          )}

          {/* Offline Toast Message */}
          {offlineToast && (
            <div className="max-w-7xl mx-auto mt-2 text-xs bg-cyan-950/90 border border-cyan-600 text-cyan-200 px-4 py-2 rounded-lg flex items-center justify-between shadow-md">
              <span>{offlineToast}</span>
              <button onClick={() => setOfflineToast('')} className="text-cyan-400 hover:text-white ml-3">✕</button>
            </div>
          )}

          {/* Pending SOS Queue Indicator */}
          {pendingSosQueue.length > 0 && (
            <div className="max-w-7xl mx-auto mt-2 text-xs bg-red-950/80 border border-red-700 text-red-200 px-4 py-2 rounded-lg flex items-center justify-between shadow-md">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <strong>{pendingSosQueue.length} Emergency SOS alert(s) queued offline.</strong> Will automatically broadcast to nearby vehicles on signal reconnect!
              </span>
              {!effectiveOffline && (
                <button
                  onClick={syncPendingSos}
                  className="bg-red-800 hover:bg-red-700 text-white text-[11px] px-2.5 py-1 rounded font-bold"
                >
                  Sync Now
                </button>
              )}
            </div>
          )}
        </header>

        {/* Low Network Banner */}
        {effectiveOffline && (
          <div className="bg-amber-950/90 border-b border-amber-700/80 px-4 py-2 text-center text-amber-200 text-xs font-semibold flex items-center justify-center gap-2">
            <span>📴</span>
            <span>MOUNTAIN DEAD-ZONE / LOW NETWORK ACTIVE — Operating on locally cached route vectors, hazard alerts & offline SOS queue.</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Route Selector & Controls */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex flex-wrap gap-4 items-end justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Origin City</label>
                  <select
                    value={originIdx}
                    onChange={(e) => setOriginIdx(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    {NER_CITIES.map((city, i) => (
                      <option key={city.name} value={i}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div className="text-gray-500 pb-2">→</div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Destination City</label>
                  <select
                    value={destIdx}
                    onChange={(e) => setDestIdx(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    {NER_CITIES.map((city, i) => (
                      <option key={city.name} value={i}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchRoute}
                  disabled={loadingRoute || originIdx === destIdx}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow"
                >
                  {loadingRoute ? '🔄 Calculating...' : '🔍 Compute Route'}
                </button>
              </div>

              {/* Petrol Pumps Quick Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFuelPumps(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                    showFuelPumps
                      ? 'bg-amber-600 border-amber-500 text-white shadow-lg'
                      : 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-300'
                  }`}
                >
                  <span>⛽</span>
                  <span>Nearby Petrol Pumps</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${showFuelPumps ? 'bg-amber-900 text-amber-100' : 'bg-gray-700 text-gray-400'}`}>
                    {showFuelPumps ? 'VISIBLE' : 'HIDDEN'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sidebar Column */}
            <div className="space-y-4">
              {/* Route Comparison Card */}
              <div className="space-y-3">
                <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Corridor Route Analysis</h3>

                {routeError && (
                  <div className="bg-red-900/40 border border-red-700 text-red-300 p-3 rounded-lg text-sm">
                    ❌ {routeError}
                  </div>
                )}

                {loadingRoute && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">Evaluating safest mountain pass...</span>
                  </div>
                )}

                {routeData && !loadingRoute && (
                  <>
                    {/* Route A */}
                    <div className={`border rounded-xl p-4 transition-all ${
                      !isRouteBRecommended ? 'bg-green-900/20 border-green-700 ring-1 ring-green-600' : 'bg-red-900/20 border-red-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-1 rounded" style={{ backgroundColor: !isRouteBRecommended ? '#22c55e' : '#ef4444' }} />
                          <span className="text-white font-bold">Route A</span>
                        </div>
                        {!isRouteBRecommended ? (
                          <span className="text-xs bg-green-900 text-green-300 border border-green-700 px-2 py-0.5 rounded font-bold">✓ RECOMMENDED</span>
                        ) : (
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">DIRECT / SHORTEST</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">
                          {routeData.route_a.distance_km ? <strong className="text-white">{routeData.route_a.distance_km} km • </strong> : null}
                          {formatTime(routeData.route_a.time_min)}
                        </span>
                        <span className={`font-bold ${getRiskColor(routeData.route_a.total_risk)}`}>
                          Risk: {routeData.route_a.total_risk}/100 {getRiskEmoji(routeData.route_a.total_risk)}
                        </span>
                      </div>
                    </div>

                    {/* Route B */}
                    <div className={`border rounded-xl p-4 transition-all ${
                      isRouteBRecommended ? 'bg-green-900/20 border-green-700 ring-1 ring-green-600' : 'bg-gray-900 border-gray-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-1 rounded" style={{ backgroundColor: isRouteBRecommended ? '#22c55e' : '#3b82f6' }} />
                          <span className="text-white font-bold">Route B</span>
                        </div>
                        {isRouteBRecommended ? (
                          <span className="text-xs bg-green-900 text-green-300 border border-green-700 px-2 py-0.5 rounded font-bold">✓ RECOMMENDED</span>
                        ) : (
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">ALTERNATIVE DETOUR</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">
                          {routeData.route_b.distance_km ? <strong className="text-white">{routeData.route_b.distance_km} km • </strong> : null}
                          {formatTime(routeData.route_b.time_min)}
                        </span>
                        <span className={`font-bold ${getRiskColor(routeData.route_b.total_risk)}`}>
                          Risk: {routeData.route_b.total_risk}/100 {getRiskEmoji(routeData.route_b.total_risk)}
                        </span>
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    {routeData.comparison && (
                      <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
                        <div className="text-blue-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                          🤖 Dispatch Recommendation
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          <span className="text-blue-400 font-bold">{routeData.comparison.recommendation}:</span>{' '}
                          {routeData.comparison.reason}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {!routeData && !loadingRoute && !routeError && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                    Select origin and destination to get route options
                  </div>
                )}
              </div>

              {/* Nearby Petrol Pumps Panel */}
              {showFuelPumps && (
                <div className="bg-gray-900 border border-amber-800/60 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-amber-400 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                      <span>⛽</span>
                      <span>Highway Fuel Stations</span>
                    </h3>
                    <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700 px-2 py-0.5 rounded">
                      {fuelStations.length} available
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {fuelStations.slice(0, 4).map((fs) => (
                      <div key={fs.id} className="bg-gray-800/80 border border-gray-700 rounded-lg p-2.5 text-xs">
                        <div className="flex justify-between items-start">
                          <strong className="text-white font-semibold">{fs.name}</strong>
                          {fs.distance_km !== undefined && (
                            <span className="text-orange-400 font-bold ml-2 shrink-0">{fs.distance_km} km</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{fs.brand} • {fs.is_24x7 ? '24x7 Open' : 'Daytime'}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {fs.fuels.map(f => (
                            <span key={f} className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                              {f}
                            </span>
                          ))}
                          {fs.def_available && (
                            <span className="bg-blue-900/60 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              DEF / AdBlue
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hazard Alerts */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg">
                <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3 font-semibold">⚠️ Live Hazard Alerts</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {incidents.length === 0 && (
                    <div className="text-gray-600 text-xs text-center py-4">No active hazards reported along this corridor</div>
                  )}
                  {incidents.map((inc) => (
                    <div key={inc.id} className={`border rounded-lg p-2.5 ${getSeverityStyle(inc.severity)}`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs">{inc.incident_type}</span>
                        <span className="text-xs opacity-75">{new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs opacity-90 mt-1">{inc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Column */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 px-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-1.5 rounded" style={{ backgroundColor: !isRouteBRecommended ? '#22c55e' : '#ef4444' }} />
                    <span className="font-medium text-white">Route A</span> {!isRouteBRecommended ? '(Recommended ✅)' : '(Shortest)'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-1.5 rounded" style={{ backgroundColor: isRouteBRecommended ? '#22c55e' : '#3b82f6' }} />
                    <span className="font-medium text-white">Route B</span> {isRouteBRecommended ? '(Recommended ✅)' : '(Detour)'}
                  </span>
                  {showFuelPumps && (
                    <span className="flex items-center gap-1 text-orange-400 font-semibold">
                      <span>⛽</span> Petrol Pumps Active
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-gray-500">
                  {origin.name} ({origin.lat.toFixed(2)}, {origin.lng.toFixed(2)}) → {destination.name} ({destination.lat.toFixed(2)}, {destination.lng.toFixed(2)})
                </div>
              </div>

              <DriverRouteMap
                startLat={origin.lat}
                startLng={origin.lng}
                endLat={destination.lat}
                endLng={destination.lng}
                routeA={routeData?.route_a ?? null}
                routeB={routeData?.route_b ?? null}
                startLabel={origin.name}
                endLabel={destination.name}
                isRouteBRecommended={isRouteBRecommended}
                showFuelPumps={showFuelPumps}
                fuelStations={fuelStations}
                isOfflineMode={effectiveOffline}
                onToggleFuelPumps={() => setShowFuelPumps(prev => !prev)}
              />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* EMERGENCY SOS MODAL */}
        {/* =================================================================== */}
        {showSosModal && (
          <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 border-2 border-red-600 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl shadow-red-950/80 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl animate-bounce">🚨</span>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-wide">EMERGENCY SOS DISPATCH</h2>
                    <p className="text-xs text-red-400">
                      Transmits distress signal to nearby logistics vehicles & Regional Emergency Operations
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSosModal(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg text-lg"
                >
                  ✕
                </button>
              </div>

              {/* SOS Result Box */}
              {sosResult && (
                <div className={`p-4 rounded-xl border ${
                  sosResult.status === 'SOS_BROADCAST_SUCCESS'
                    ? 'bg-red-950/90 border-red-500 text-white'
                    : 'bg-yellow-950/90 border-yellow-500 text-yellow-100'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <span>{sosResult.status === 'SOS_BROADCAST_SUCCESS' ? '📡 SOS TRANSMITTED' : '📴 OFFLINE QUEUED'}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-95">{sosResult.message}</p>

                  {/* Alerted Vehicles List */}
                  {sosResult.alerted_vehicles && sosResult.alerted_vehicles.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-red-700/60">
                      <div className="text-[11px] font-bold text-red-200 mb-1.5 uppercase">
                        Nearby Logistics Vehicles Alerted ({sosResult.alerted_vehicles.length}):
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {sosResult.alerted_vehicles.map((v: any) => (
                          <div key={v.vehicle_id} className="bg-red-900/60 rounded px-2.5 py-1.5 text-xs flex justify-between items-center">
                            <div>
                              <strong className="text-white">{v.driver_name}</strong>
                              <span className="text-red-300 ml-2 text-[11px] font-mono">[{v.radio_channel}]</span>
                            </div>
                            <span className="font-bold text-yellow-300">{v.distance_km} km away</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowSosModal(false)}
                    className="mt-3 w-full bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg transition-all"
                  >
                    Close Dialog
                  </button>
                </div>
              )}

              {!sosResult && (
                <>
                  {/* Disaster / Emergency Category */}
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2 font-semibold">
                      Select Disaster / Incident Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'LANDSLIDE', label: '🏔️ Landslide / Rockfall' },
                        { key: 'FLASH_FLOOD', label: '🌊 Flash Flood / Overflow' },
                        { key: 'ROAD_COLLAPSE', label: '🌉 Road / Bridge Collapse' },
                        { key: 'VEHICLE_STRANDED', label: '⚠️ Vehicle Breakdown / Stranded' },
                        { key: 'MEDICAL', label: '🏥 Medical Emergency' },
                        { key: 'SEVERE_STORM', label: '🌪️ Severe Storm / Cloudburst' },
                      ].map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setSosDisasterType(type.key)}
                          className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all ${
                            sosDisasterType === type.key
                              ? 'bg-red-600 border-red-400 text-white shadow-lg'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Severity Level */}
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2 font-semibold">
                      Severity Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'CRITICAL', label: '🔴 CRITICAL', desc: 'Threat to life / impassable' },
                        { key: 'HIGH', label: '🟠 HIGH', desc: 'Severe blockage' },
                        { key: 'MEDIUM', label: '🟡 MEDIUM', desc: 'Assistance needed' },
                      ].map((sev) => (
                        <button
                          key={sev.key}
                          type="button"
                          onClick={() => setSosSeverity(sev.key as any)}
                          className={`p-2 rounded-xl text-center border transition-all ${
                            sosSeverity === sev.key
                              ? 'bg-gray-800 border-red-500 text-white ring-2 ring-red-500'
                              : 'bg-gray-850 border-gray-700 text-gray-400 hover:bg-gray-800'
                          }`}
                        >
                          <div className="text-xs font-bold">{sev.label}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{sev.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location Info */}
                  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-[10px] uppercase font-bold">GPS Coordinates Broadcast</div>
                      <div className="font-mono text-white mt-0.5">
                        {origin.lat.toFixed(4)}°N, {origin.lng.toFixed(4)}°E ({origin.name} Sector)
                      </div>
                    </div>
                    <span className="text-[11px] bg-red-950 text-red-300 border border-red-700 px-2 py-0.5 rounded font-semibold">
                      Radius: 60 km
                    </span>
                  </div>

                  {/* Voice / Description Input */}
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1 font-semibold">
                      Situation Notes (Optional)
                    </label>
                    <textarea
                      value={sosNotes}
                      onChange={(e) => setSosNotes(e.target.value)}
                      placeholder="e.g. Major rockslide 4km ahead, road completely blocked, 2 trucks trapped behind..."
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>

                  {/* Broadcast Trigger */}
                  <button
                    onClick={transmitSos}
                    disabled={sosTransmitting}
                    className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white shadow-xl shadow-red-900/60 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
                  >
                    {sosTransmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Broadcasting Distress Beacon...</span>
                      </>
                    ) : (
                      <>
                        <span>🚨</span>
                        <span>{effectiveOffline ? 'Queue SOS in Offline Memory' : 'TRANSMIT EMERGENCY SOS & ALERT CONVOY'}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

