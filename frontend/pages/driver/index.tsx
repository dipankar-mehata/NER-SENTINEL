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

// ── Driver ID (would come from auth in production) ────────────────
const DRIVER_ID = 'driver-' + (typeof window !== 'undefined' ? (localStorage.getItem('ner-driver-id') || Math.random().toString(36).slice(2, 8)) : 'demo');
const DRIVER_NAME = typeof window !== 'undefined' ? (localStorage.getItem('ner-driver-name') || 'Field Driver') : 'Field Driver';

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
    const icons: Record<string, string> = {
      storm: '⛈️', rain: '🌧️', drizzle: '🌦️', fog: '🌫️', clear: '☀️', cloudy: '⛅',
    };
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

// ── Main Component ────────────────────────────────────────────────
export default function DriverPortal() {
  const { t } = useTranslation();

  // Route selection
  const [originIdx,  setOriginIdx]  = useState(0);
  const [destIdx,    setDestIdx]    = useState(1);
  const [routeReady, setRouteReady] = useState(false);

  // GPS tracking
  const [gpsTracking,   setGpsTracking]   = useState(false);
  const [currentPos,    setCurrentPos]    = useState<{ lat: number; lng: number } | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // SOS
  const [sosSent, setSosSent]  = useState(false);
  const [sosMsg,  setSosMsg]   = useState('');

  // Firebase listeners
  const activeRoute    = useActiveRoute(routeReady ? DRIVER_ID : null);
  const rerouteEvents  = useRerouteEvents(routeReady ? DRIVER_ID : null);

  const origin = NER_CITIES[originIdx];
  const dest   = NER_CITIES[destIdx];

  // ── Fetch weather for current/origin location ─────────────────
  useEffect(() => {
    const loc = currentPos ?? { lat: origin.lat, lng: origin.lng };
    fetchLocationWeather(loc.lat, loc.lng).then(setWeather);
  }, [currentPos, origin.lat, origin.lng]);

  // ── GPS Tracking ─────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsTracking(true);
    const update = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setCurrentPos({ lat, lng });
          publishVehicleLocation(DRIVER_ID, lat, lng, 0, 0, { driverName: DRIVER_NAME, status: 'en-route' });
        },
        () => {
          // Fallback: simulate location near origin
          const lat = origin.lat + (Math.random() - 0.5) * 0.02;
          const lng = origin.lng + (Math.random() - 0.5) * 0.02;
          setCurrentPos({ lat, lng });
          publishVehicleLocation(DRIVER_ID, lat, lng, 45, 40, { driverName: DRIVER_NAME, status: 'en-route' });
        }
      );
    };
    update();
    trackingIntervalRef.current = setInterval(update, 5000);
  }, [origin.lat, origin.lng]);

  const stopTracking = useCallback(() => {
    setGpsTracking(false);
    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    publishVehicleLocation(DRIVER_ID, origin.lat, origin.lng, 0, 0, { status: 'stopped' });
  }, [origin.lat, origin.lng]);

  useEffect(() => {
    return () => { if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current); };
  }, []);

  // ── SOS ──────────────────────────────────────────────────────
  const sendSOS = useCallback(async () => {
    const loc = currentPos ?? { lat: origin.lat, lng: origin.lng };
    await triggerSOS(DRIVER_ID, DRIVER_NAME, loc.lat, loc.lng, sosMsg || 'Emergency! Immediate assistance needed.');
    setSosSent(true);
    setTimeout(() => setSosSent(false), 5000);
  }, [currentPos, origin.lat, origin.lng, sosMsg]);

  // ── Acknowledge reroute events ────────────────────────────────
  const ackReroute = useCallback(async (id: string) => {
    await acknowledgeReroute(id);
  }, []);

  return (
    <>
      <Head>
        <title>{t('driverTitle')} — NER-SENTINEL</title>
      </Head>

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
            </div>

            {/* GPS pill */}
            <button
              onClick={gpsTracking ? stopTracking : startTracking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                gpsTracking
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-green-50 hover:border-green-300'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${gpsTracking ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`} />
              {gpsTracking ? t('trackingActive') : t('gpsTracking')}
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
                    {NER_CITIES.map((c, i) => (
                      <option key={c.name} value={i}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">{t('selectDestination')}</label>
                  <select
                    value={destIdx}
                    onChange={e => { setDestIdx(+e.target.value); setRouteReady(false); }}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  >
                    {NER_CITIES.map((c, i) => (
                      <option key={c.name} value={i} disabled={i === originIdx}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => { if (originIdx !== destIdx) setRouteReady(true); }}
                disabled={originIdx === destIdx}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
              >
                🧠 {t('getRoute')}
              </button>

              {/* Active Firebase route info */}
              {activeRoute && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="bg-neutral-100 px-2 py-1 rounded-lg text-neutral-600">
                    ⏱️ ~{activeRoute.estimatedTimeMin} min
                  </span>
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
                    <WeatherStat icon="💧" label={t('humidity')} value={`${weather.rain.toFixed(1)} mm`} />
                    <WeatherStat icon="💨" label={t('windSpeed')} value={`${weather.windSpeed.toFixed(0)} km/h`} />
                  </div>
                  {weather.condition === 'storm' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 font-medium">
                      ⚠️ Severe weather — exercise caution
                    </div>
                  )}
                  {weather.condition === 'rain' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 font-medium">
                      🌧️ Rain expected — reduce speed
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-neutral-400 text-sm">{t('loading')}</div>
              )}
              <div className="mt-3 text-[10px] text-neutral-300">
                📍 {currentPos ? `${currentPos.lat.toFixed(3)}, ${currentPos.lng.toFixed(3)}` : `${origin.name}`} · Open-Meteo
              </div>
            </div>
          </div>

          {/* SOS + GPS Status row */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* SOS Panel */}
            <div className="bg-white rounded-2xl border-2 border-red-100 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span>🚨</span> Emergency SOS
              </h2>
              <input
                type="text"
                value={sosMsg}
                onChange={e => setSosMsg(e.target.value)}
                placeholder="Describe your emergency (optional)…"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-red-400"
              />
              <button
                onClick={sendSOS}
                disabled={sosSent}
                className={`w-full py-3 font-black text-sm rounded-xl transition-all shadow-sm ${
                  sosSent
                    ? 'bg-green-500 text-white'
                    : 'bg-red-600 hover:bg-red-700 active:scale-95 text-white animate-sos-pulse'
                }`}
              >
                {sosSent ? `✅ ${t('sosSent')}` : `🚨 ${t('sosButton')}`}
              </button>
            </div>

            {/* GPS status */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span>📍</span> {t('gpsTracking')}
              </h2>
              <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 ${gpsTracking ? 'bg-green-50 border border-green-200' : 'bg-neutral-50 border border-neutral-100'}`}>
                <div className={`w-3 h-3 rounded-full ${gpsTracking ? 'bg-green-500 animate-pulse' : 'bg-neutral-300'}`} />
                <div>
                  <div className={`text-sm font-semibold ${gpsTracking ? 'text-green-700' : 'text-neutral-500'}`}>
                    {gpsTracking ? t('trackingActive') : t('trackingOff')}
                  </div>
                  {currentPos && (
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">
                      {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2">
                {gpsTracking
                  ? '🔴 Publishing location to Command Center every 5 seconds via Firebase'
                  : '💡 Enable GPS to share your position with the Command Center in real-time'}
              </div>
            </div>
          </div>

          {/* Simulation Map */}
          {routeReady && originIdx !== destIdx ? (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
              <h2 className="font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-red-600">🎮</span> AI Route & Simulation
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  {origin.name} → {dest.name}
                </span>
              </h2>
              <SimulationMap
                vehicleId={DRIVER_ID}
                driverName={DRIVER_NAME}
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
              <div className="font-medium text-neutral-500">Select an origin and destination, then click <span className="text-red-600 font-bold">Get AI Route</span> to load the simulation map</div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function WeatherStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-2">
      <div className="text-neutral-400">{icon} {label}</div>
      <div className="font-bold text-neutral-700">{value}</div>
    </div>
  );
}
