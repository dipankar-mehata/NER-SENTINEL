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

  const origin = NER_CITIES[originIdx];
  const destination = NER_CITIES[destIdx];

  const fetchRoute = useCallback(async () => {
    if (originIdx === destIdx) return;
    setLoadingRoute(true);
    setRouteError('');
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
    } catch (e: unknown) {
      setRouteError(e instanceof Error ? e.message : 'Failed to fetch route.');
    } finally {
      setLoadingRoute(false);
    }
  }, [originIdx, destIdx, origin, destination]);

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`);
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchRoute();
    fetchIncidents();
  }, [fetchRoute]);

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

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
              <div className="w-px h-4 bg-gray-700" />
              <div className="text-sm">
                <span className="font-bold text-white">Vehicle #{vehicleId}</span>
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
            <button
              onClick={shareLocation}
              className={`text-xs px-4 py-2 rounded-lg font-bold transition-all ${
                locationShared
                  ? 'bg-green-700 text-green-100'
                  : 'bg-blue-700 hover:bg-blue-600 text-white'
              }`}
            >
              {locationShared ? '✅ Location Shared' : '📍 Share My Location'}
            </button>
          </div>
          {locationError && (
            <div className="max-w-6xl mx-auto mt-2 text-red-400 text-xs bg-red-900/30 border border-red-800 px-3 py-1.5 rounded-lg">
              ⚠️ {locationError}
            </div>
          )}
        </header>

        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Route Selector */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Origin</label>
                <select
                  value={originIdx}
                  onChange={(e) => setOriginIdx(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  {NER_CITIES.map((city, i) => (
                    <option key={city.name} value={i}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div className="text-gray-500 pb-2">→</div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Destination</label>
                <select
                  value={destIdx}
                  onChange={(e) => setDestIdx(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  {NER_CITIES.map((city, i) => (
                    <option key={city.name} value={i}>{city.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchRoute}
                disabled={loadingRoute || originIdx === destIdx}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all"
              >
                {loadingRoute ? '🔄 Calculating...' : '🔍 Get Routes'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Route Comparison */}
            <div className="space-y-3">
              <h3 className="text-gray-400 text-xs uppercase tracking-wider">Route Comparison</h3>

              {routeError && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 p-3 rounded-lg text-sm">
                  ❌ {routeError}
                </div>
              )}

              {loadingRoute && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">Calculating routes...</span>
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
                    isRouteBRecommended ? 'bg-green-900/20 border-green-700 ring-1 ring-green-600' : 'bg-gray-900 border-gray-700'
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
                        🤖 System Recommendation
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
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center text-gray-500 text-sm">
                  Select origin and destination to get route options
                </div>
              )}

              {/* Hazard Alerts */}
              <div>
                <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">⚠️ Live Hazard Alerts</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {incidents.length === 0 && (
                    <div className="text-gray-600 text-xs text-center py-4">No active hazards reported</div>
                  )}
                  {incidents.map((inc) => (
                    <div key={inc.id} className={`border rounded-lg p-2.5 ${getSeverityStyle(inc.severity)}`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-xs">{inc.incident_type}</span>
                        <span className="text-xs opacity-70">{new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs opacity-80 mt-0.5">{inc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-1 rounded" style={{ backgroundColor: !isRouteBRecommended ? '#22c55e' : '#ef4444' }} />
                  Route A {!isRouteBRecommended ? '(Recommended ✅)' : '(Shortest)'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-1 rounded" style={{ backgroundColor: isRouteBRecommended ? '#22c55e' : '#3b82f6' }} />
                  Route B {isRouteBRecommended ? '(Recommended ✅)' : '(Alternative)'}
                </span>
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
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
