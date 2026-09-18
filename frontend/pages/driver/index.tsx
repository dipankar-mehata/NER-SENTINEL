import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import '../../lib/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import {
  publishVehicleLocation,
  triggerSOS,
  useActiveRoute,
  useRerouteEvents,
  acknowledgeReroute,
  setDriverStatus,
  RerouteEvent,
} from '../../lib/firebaseRealtimeSync';
import type { SimulationMapProps } from '../../components/SimulationMap';

const SimulationMap = dynamic<SimulationMapProps>(
  () => import('../../components/SimulationMap'),
  { ssr: false }
);

// ── City list ─────────────────────────────────────────────────────
const NER_CITIES = [
  { name: 'Guwahati',   lat: 26.1445, lng: 91.7362 },
  { name: 'Tezpur',     lat: 26.6336, lng: 92.8004 },
  { name: 'Jorhat',     lat: 26.7465, lng: 94.2026 },
  { name: 'Dibrugarh',  lat: 27.4728, lng: 94.9120 },
  { name: 'Silchar',    lat: 24.8333, lng: 92.7789 },
  { name: 'Itanagar',   lat: 27.0844, lng: 93.6053 },
  { name: 'Shillong',   lat: 25.5788, lng: 91.8933 },
  { name: 'Imphal',     lat: 24.8170, lng: 93.9368 },
  { name: 'Kohima',     lat: 25.6747, lng: 94.1086 },
  { name: 'Aizawl',     lat: 23.7271, lng: 92.7176 },
  { name: 'Agartala',   lat: 23.8315, lng: 91.2868 },
  { name: 'Gangtok',    lat: 27.3389, lng: 88.6065 },
  { name: 'Nagaon',     lat: 26.3503, lng: 92.6837 },
  { name: 'Lakhimpur',  lat: 27.2368, lng: 94.1032 },
  { name: 'Goalpara',   lat: 26.1736, lng: 90.6235 },
];

// ── Weather hook ─────────────────────────────────────────────────
interface WeatherData {
  temp: number;
  condition: string;
  rain: number;
  windSpeed: number;
  icon: string;
}

async function fetchLocationWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`
    );
    const data = await res.json();
    if (!data.current) return null;
    const wc = data.current.weather_code || 0;
    const icons: Record<string, string> = { storm: '⛈️', rain: '🌧️', drizzle: '🌦️', fog: '🌫️', clear: '☀️', cloudy: '⛅' };
    const condition = wc >= 95 ? 'storm' : wc >= 80 ? 'rain' : wc >= 51 ? 'drizzle' : wc >= 45 ? 'fog' : wc >= 3 ? 'cloudy' : 'clear';
    return {
      temp:      data.current.temperature_2m,
      condition,
      rain:      data.current.precipitation,
      windSpeed: data.current.wind_speed_10m,
      icon:      icons[condition] || '🌡️',
    };
  } catch { return null; }
}

// ── GPS Signal helper ────────────────────────────────────────────
function getSignalBars(accuracy: number | null): number {
  if (accuracy === null) return 0;
  if (accuracy < 10) return 4;
  if (accuracy < 30) return 3;
  if (accuracy < 100) return 2;
  return 1;
}

// ── Main Component ────────────────────────────────────────────────
export default function DriverPortal() {
  const { t } = useTranslation();

  // Driver identity — resolved client-side only
  const [driverId, setDriverId]     = useState('driver-demo');
  const [driverName, setDriverName] = useState('Field Driver');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput]   = useState('');

  useEffect(() => {
    const storedId   = localStorage.getItem('ner-driver-id');
    const storedName = localStorage.getItem('ner-driver-name');
    const newId = storedId || 'driver-' + Math.random().toString(36).slice(2, 8);
    if (!storedId) localStorage.setItem('ner-driver-id', newId);
    setDriverId(newId);
    if (storedName) {
      setDriverName(storedName);
    } else {
      setShowNameModal(true); // First visit: ask for name
    }
  }, []);

  const saveDriverName = useCallback(() => {
    const name = nameInput.trim() || 'Field Driver';
    setDriverName(name);
    localStorage.setItem('ner-driver-name', name);
    setShowNameModal(false);
    setDriverStatus(driverId, 'online', { driverName: name });
  }, [nameInput, driverId]);

  // Route selection
  const [originIdx,  setOriginIdx]  = useState(0);
  const [destIdx,    setDestIdx]    = useState(1);
  const [routeReady, setRouteReady] = useState(false);

  // GPS tracking
  const [gpsTracking,    setGpsTracking]    = useState(false);
  const [currentPos,     setCurrentPos]     = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy,    setGpsAccuracy]    = useState<number | null>(null);
  const [gpsError,       setGpsError]       = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // SOS
  const [sosSent, setSosSent] = useState(false);
  const [sosMsg,  setSosMsg]  = useState('');

  // Firebase listeners — only after driverId is resolved
  const activeRoute   = useActiveRoute(routeReady ? driverId : null);
  const rerouteEvents = useRerouteEvents(routeReady ? driverId : null);

  const origin = NER_CITIES[originIdx];
  const dest   = NER_CITIES[destIdx];

  // Register online/offline status
  useEffect(() => {
    if (driverId === 'driver-demo') return;
    setDriverStatus(driverId, 'online', { driverName });
    const handleUnload = () => setDriverStatus(driverId, 'offline');
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [driverId, driverName]);

  // Weather updates when position changes
  useEffect(() => {
    const loc = currentPos ?? { lat: origin.lat, lng: origin.lng };
    fetchLocationWeather(loc.lat, loc.lng).then(setWeather);
  }, [currentPos, origin.lat, origin.lng]);

  // ── GPS watchPosition ─────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by this browser');
      return;
    }
    setGpsTracking(true);
    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setCurrentPos({ lat, lng });
        setGpsAccuracy(accuracy);
        setGpsError(null);
        publishVehicleLocation(driverId, lat, lng, 0, 0, {
          driverName,
          status: 'en-route',
          accuracy,
        });
      },
      (err) => {
        setGpsError(err.message);
        // Fallback: simulate position near origin
        const lat = origin.lat + (Math.random() - 0.5) * 0.02;
        const lng = origin.lng + (Math.random() - 0.5) * 0.02;
        setCurrentPos({ lat, lng });
        setGpsAccuracy(500); // mock low accuracy
        publishVehicleLocation(driverId, lat, lng, 45, 40, { driverName, status: 'en-route' });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, [driverId, driverName, origin.lat, origin.lng]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsTracking(false);
    setGpsAccuracy(null);
    setDriverStatus(driverId, 'stopped');
  }, [driverId]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ── SOS ──────────────────────────────────────────────────────
  const sendSOS = useCallback(async () => {
    const loc = currentPos ?? { lat: origin.lat, lng: origin.lng };
    await triggerSOS(driverId, driverName, loc.lat, loc.lng, sosMsg || 'Emergency! Immediate assistance needed.');
    setSosSent(true);
    setTimeout(() => setSosSent(false), 5000);
  }, [currentPos, origin.lat, origin.lng, driverId, driverName, sosMsg]);

  const ackReroute = useCallback(async (id: string) => {
    await acknowledgeReroute(id);
  }, []);

  const signalBars = getSignalBars(gpsAccuracy);

  return (
    <>
      <Head>
        <title>{t('driverTitle')} — NER-SENTINEL</title>
        <meta name="description" content="NER-SENTINEL Driver Portal — GPS tracking, route navigation, SOS" />
      </Head>

      {/* ── Driver Name Modal ─────────────────────────────────── */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto shadow-lg">🚚</div>
            <h2 className="text-lg font-black text-neutral-900 text-center mb-1">Welcome, Driver</h2>
            <p className="text-sm text-neutral-500 text-center mb-5">Enter your name so Command Center can identify you on the map</p>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDriverName()}
              placeholder="Your name (e.g. Rajesh Kumar)"
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 mb-4"
              autoFocus
            />
            <button
              onClick={saveDriverName}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-sm"
            >
              Start Driving 🚀
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-neutral-50 flex flex-col" style={{ fontFamily: 'Satoshi, sans-serif' }}>
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-base shadow-sm">🚚</div>
                <div className="hidden sm:block">
                  <div className="text-xs font-black text-neutral-900 tracking-wide">NER-SENTINEL</div>
                  <div className="text-[10px] text-neutral-400">{t('driverTitle')}</div>
                </div>
              </Link>
              <div className="hidden sm:block text-xs text-neutral-300">|</div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-600">
                <div className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-sm">👤</div>
                <span className="font-semibold">{driverName}</span>
              </div>
            </div>

            {/* GPS toggle pill */}
            <button
              id="gps-toggle-btn"
              onClick={gpsTracking ? stopTracking : startTracking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                gpsTracking
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-green-50 hover:border-green-300'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${gpsTracking ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`} />
              {gpsTracking ? '📡 Live GPS' : '📍 Enable GPS'}
              {/* Signal bars */}
              {gpsTracking && (
                <div className="flex items-end gap-0.5 ml-1">
                  {[1,2,3,4].map(bar => (
                    <div
                      key={bar}
                      className={`w-1 rounded-sm ${bar <= signalBars ? 'bg-green-500' : 'bg-green-200'}`}
                      style={{ height: `${bar * 3}px` }}
                    />
                  ))}
                </div>
              )}
            </button>

            <LanguageSwitcher compact />
          </div>
        </header>

        {/* ── Reroute notification banners ─────────────────── */}
        {rerouteEvents.map((ev: RerouteEvent) => (
          <div key={ev.id} className="mx-4 mt-3 bg-orange-50 border border-orange-300 rounded-xl p-3 flex items-start gap-3 animate-slide-in">
            <span className="text-xl">🔄</span>
            <div className="flex-1">
              <div className="font-bold text-orange-800 text-sm">{t('rerouted')}</div>
              <div className="text-xs text-orange-700 mt-0.5">{t('reroutedMsg')}</div>
              <div className="text-xs text-neutral-500 mt-1">Reason: {ev.reason} — {ev.newRouteSummary}</div>
            </div>
            <button onClick={() => ackReroute(ev.id)} className="text-xs font-semibold text-orange-600 hover:text-orange-800 underline">
              {t('acknowledge')}
            </button>
          </div>
        ))}

        {/* ── Main ─────────────────────────────────────────── */}
        <main className="flex-1 p-4 space-y-4">
          {/* Top row: Route selector + Weather */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Route Selector */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-red-600">🗺️</span> {t('myRoute')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">{t('selectOrigin')}</label>
                  <select
                    value={originIdx}
                    onChange={e => { setOriginIdx(+e.target.value); setRouteReady(false); }}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  >
                    {NER_CITIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">{t('selectDestination')}</label>
                  <select
                    value={destIdx}
                    onChange={e => { setDestIdx(+e.target.value); setRouteReady(false); }}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  >
                    {NER_CITIES.map((c, i) => <option key={c.name} value={i} disabled={i === originIdx}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button
                id="get-route-btn"
                onClick={() => { if (originIdx !== destIdx) setRouteReady(true); }}
                disabled={originIdx === destIdx}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
              >
                🧠 {t('getRoute')}
              </button>

              {/* Active Firebase route info */}
              {activeRoute && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="bg-neutral-100 px-2 py-1 rounded-lg text-neutral-600">⏱️ ~{activeRoute.estimatedTimeMin} min</span>
                  <span className={`px-2 py-1 rounded-lg font-semibold ${
                    activeRoute.totalRiskScore > 0.6 ? 'bg-red-100 text-red-700' :
                    activeRoute.totalRiskScore > 0.3 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    Risk: {(activeRoute.totalRiskScore * 100).toFixed(0)}%
                  </span>
                  {activeRoute.rerouteFlag && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-semibold">⚠️ Rerouted</span>
                  )}
                </div>
              )}
            </div>

            {/* Weather Widget */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span>🌡️</span> {t('weather')}
              </h2>
              {weather ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{weather.icon}</span>
                    <div>
                      <div className="text-3xl font-black text-neutral-900">{weather.temp.toFixed(1)}°C</div>
                      <div className="text-sm text-neutral-500 capitalize">{weather.condition}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">💧 {t('humidity')}</div>
                      <div className="font-bold text-neutral-700">{weather.rain.toFixed(1)} mm</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">💨 {t('windSpeed')}</div>
                      <div className="font-bold text-neutral-700">{weather.windSpeed.toFixed(0)} km/h</div>
                    </div>
                  </div>
                  {weather.condition === 'storm' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 font-medium">
                      ⚠️ Severe weather — exercise extreme caution
                    </div>
                  )}
                  {weather.condition === 'rain' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 font-medium">
                      🌧️ Rain — reduce speed, watch for landslides
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-neutral-400 text-sm animate-pulse">{t('loading')}</div>
              )}
              <div className="mt-3 text-[10px] text-neutral-300">
                📍 {currentPos ? `${currentPos.lat.toFixed(4)}, ${currentPos.lng.toFixed(4)}` : origin.name} · Open-Meteo
              </div>
            </div>
          </div>

          {/* SOS + GPS Status row */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* SOS Panel */}
            <div className="bg-white rounded-2xl border-2 border-red-100 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2"><span>🚨</span> Emergency SOS</h2>
              <input
                type="text"
                value={sosMsg}
                onChange={e => setSosMsg(e.target.value)}
                placeholder="Describe your emergency (optional)…"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-red-400"
              />
              <button
                id="sos-btn"
                onClick={sendSOS}
                disabled={sosSent}
                className={`w-full py-3 font-black text-sm rounded-xl transition-all shadow-sm ${
                  sosSent ? 'bg-green-500 text-white' : 'bg-red-600 hover:bg-red-700 active:scale-95 text-white'
                }`}
              >
                {sosSent ? `✅ ${t('sosSent')}` : `🚨 ${t('sosButton')}`}
              </button>
            </div>

            {/* GPS Status Panel */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2"><span>📍</span> {t('gpsTracking')}</h2>
              <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 ${gpsTracking ? 'bg-green-50 border border-green-200' : 'bg-neutral-50 border border-neutral-100'}`}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${gpsTracking ? 'bg-green-500 animate-pulse' : 'bg-neutral-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${gpsTracking ? 'text-green-700' : 'text-neutral-500'}`}>
                    {gpsTracking ? t('trackingActive') : t('trackingOff')}
                  </div>
                  {currentPos && (
                    <div className="text-xs text-neutral-400 font-mono mt-0.5 truncate">
                      {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
                    </div>
                  )}
                  {gpsAccuracy !== null && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Accuracy: ±{gpsAccuracy < 1000 ? gpsAccuracy.toFixed(0) + 'm' : (gpsAccuracy / 1000).toFixed(1) + 'km'}
                    </div>
                  )}
                </div>
                {/* Signal bars */}
                {gpsTracking && (
                  <div className="flex items-end gap-0.5">
                    {[1,2,3,4].map(bar => (
                      <div
                        key={bar}
                        className={`w-1.5 rounded-sm ${bar <= signalBars ? 'bg-green-500' : 'bg-neutral-200'}`}
                        style={{ height: `${bar * 4}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {gpsError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700 mb-2">
                  ⚠️ GPS fallback: {gpsError}
                </div>
              )}
              <div className="text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2">
                {gpsTracking
                  ? '🔴 Publishing live location to Command Center via Firebase'
                  : '💡 Enable GPS to share your position with Command Center in real-time'}
              </div>
            </div>
          </div>

          {/* Simulation Map */}
          {routeReady && originIdx !== destIdx ? (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-red-600">🎮</span> AI Route & Simulation
                <span className="ml-2 text-xs font-normal text-neutral-400">{origin.name} → {dest.name}</span>
              </h2>
              <SimulationMap
                vehicleId={driverId}
                driverName={driverName}
                startLat={currentPos?.lat ?? origin.lat}
                startLng={currentPos?.lng ?? origin.lng}
                startLabel={origin.name}
                endLat={dest.lat}
                endLng={dest.lng}
                endLabel={dest.name}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-8 text-center text-neutral-400">
              <div className="text-4xl mb-3">🗺️</div>
              <div className="font-medium text-neutral-500">
                Select an origin and destination, then click <span className="text-red-600 font-bold">Get AI Route</span> to load the simulation map
              </div>
              <div className="text-xs text-neutral-400 mt-2">Routes use real roads via OSRM when available</div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
