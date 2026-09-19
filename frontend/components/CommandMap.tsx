import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FirebaseVehicle, SOSAlert } from '../lib/firebaseRealtimeSync';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#DC2626',
  MODERATE: '#F59E0B',
  LOW: '#16A34A',
};

function makeVehicleIcon(priority: string) {
  const bg = PRIORITY_COLORS[priority] || '#6B7280';
  return L.divIcon({
    html: `<div style="background:${bg};border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)" title="${priority} priority">🚚</div>`,
    iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22], className: '',
  });
}

function makeSOSIcon() {
  return L.divIcon({
    html: `<div style="position:relative"><div style="background:#DC2626;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid white;box-shadow:0 0 0 6px rgba(220,38,38,0.25),0 3px 10px rgba(0,0,0,0.4);animation:sos-pulse 1.4s ease-in-out infinite">🚨</div></div>`,
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -24], className: '',
  });
}

function makeWeatherIcon(condition: string, rain: number, windSpeed: number) {
  const emoji = condition === 'storm' ? '⛈️' : condition === 'rain' || rain > 5 ? '🌧️' : condition === 'fog' ? '🌫️' : windSpeed > 40 ? '💨' : '☀️';
  const bg = condition === 'storm' ? '#7C3AED' : condition === 'rain' || rain > 5 ? '#2563EB' : condition === 'fog' ? '#6B7280' : '#F59E0B';
  const pulse = condition === 'storm' ? 'animation:sos-pulse 2s ease-in-out infinite;' : '';
  return L.divIcon({
    html: `<div style="background:${bg};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);${pulse}">${emoji}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20], className: '',
  });
}

// ── Disaster data ─────────────────────────────────────────────────
interface DisasterPoint { id: string; lat: number; lng: number; type: string; title: string; severity: number; }

async function fetchGDACSDisasters(): Promise<DisasterPoint[]> {
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.features || []).slice(0, 20).map((f: any) => ({
      id: f.id, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      type: 'earthquake', title: f.properties.place, severity: Math.min(f.properties.mag / 10, 1),
    }));
  } catch { return []; }
}

// ── Weather overlay ───────────────────────────────────────────────
interface WeatherPoint { lat: number; lng: number; temp: number; rain: number; windSpeed: number; condition: string; cityName: string; }

const NE_WEATHER_GRID = [
  { lat: 26.14, lng: 91.74, name: 'Guwahati' },
  { lat: 26.63, lng: 92.80, name: 'Tezpur' },
  { lat: 26.75, lng: 94.20, name: 'Jorhat' },
  { lat: 27.47, lng: 94.91, name: 'Dibrugarh' },
  { lat: 24.83, lng: 92.78, name: 'Silchar' },
  { lat: 27.08, lng: 93.60, name: 'Itanagar' },
  { lat: 25.58, lng: 91.89, name: 'Shillong' },
  { lat: 24.82, lng: 93.94, name: 'Imphal' },
  { lat: 25.67, lng: 94.11, name: 'Kohima' },
  { lat: 23.73, lng: 92.72, name: 'Aizawl' },
  { lat: 23.83, lng: 91.29, name: 'Agartala' },
  { lat: 27.34, lng: 88.61, name: 'Gangtok' },
];

async function fetchWeatherGrid(): Promise<WeatherPoint[]> {
  // Fetch each point individually for reliability
  const results = await Promise.allSettled(
    NE_WEATHER_GRID.map(async (pt) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.current) throw new Error('no data');
      const wc = data.current.weather_code || 0;
      return {
        lat: pt.lat, lng: pt.lng, cityName: pt.name,
        temp: data.current.temperature_2m || 0,
        rain: data.current.precipitation || 0,
        windSpeed: data.current.wind_speed_10m || 0,
        condition: wc >= 95 ? 'storm' : wc >= 61 ? 'rain' : wc >= 45 ? 'fog' : 'clear',
      } as WeatherPoint;
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    // Fallback mock data for failed points
    return {
      lat: NE_WEATHER_GRID[i].lat, lng: NE_WEATHER_GRID[i].lng, cityName: NE_WEATHER_GRID[i].name,
      temp: 25 + Math.random() * 8, rain: Math.random() * 12, windSpeed: 10 + Math.random() * 25,
      condition: Math.random() > 0.65 ? 'rain' : 'clear',
    };
  });
}

function weatherCircleColor(w: WeatherPoint): string {
  if (w.condition === 'storm') return 'rgba(124,58,237,0.35)';
  if (w.condition === 'rain' || w.rain > 5) return 'rgba(37,99,235,0.25)';
  if (w.condition === 'fog') return 'rgba(107,114,128,0.22)';
  if (w.windSpeed > 40) return 'rgba(249,115,22,0.2)';
  return 'rgba(34,197,94,0.12)';
}

function weatherBorderColor(w: WeatherPoint): string {
  if (w.condition === 'storm') return '#7C3AED';
  if (w.condition === 'rain' || w.rain > 5) return '#3B82F6';
  if (w.condition === 'fog') return '#9CA3AF';
  return 'transparent';
}

// ── MapFitBounds ──────────────────────────────────────────────────
function MapFitBounds({ vehicles }: { vehicles: FirebaseVehicle[] }) {
  const map = useMap();
  useEffect(() => {
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.length]);
  return null;
}

// ── Main Component ────────────────────────────────────────────────
export default function CommandMap({ vehicles, sosAlerts }: { vehicles: FirebaseVehicle[]; sosAlerts: SOSAlert[] }) {
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [disasters, setDisasters] = useState<DisasterPoint[]>([]);
  const [layers, setLayers] = useState({ vehicles: true, weather: true, disasters: true, terrain: false });
  const [weatherLoading, setWeatherLoading] = useState(false);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    const w = await fetchWeatherGrid();
    setWeatherData(w);
    setWeatherLoading(false);
  }, []);

  useEffect(() => {
    loadWeather();
    fetchGDACSDisasters().then(setDisasters);
    const interval = setInterval(loadWeather, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [loadWeather]);

  const toggleLayer = useCallback((key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const displayVehicles: FirebaseVehicle[] = vehicles.length > 0 ? vehicles : [
    { id: 'V001', driverName: 'Rajesh Kumar',  status: 'en-route', lat: 26.14, lng: 91.74, speed: 52, heading: 90,  destinationName: 'Tezpur',     destinationLat: 26.63, destinationLng: 92.80, payloadType: 'Medical',   priority: 'HIGH',     currentLoadPct: 87,  updatedAt: null },
    { id: 'V002', driverName: 'Priya Das',     status: 'en-route', lat: 26.35, lng: 92.68, speed: 38, heading: 45,  destinationName: 'Jorhat',     destinationLat: 26.75, destinationLng: 94.20, payloadType: 'Food',      priority: 'MODERATE', currentLoadPct: 95,  updatedAt: null },
    { id: 'V003', driverName: 'Mohan Singh',   status: 'stopped',  lat: 27.47, lng: 94.91, speed: 0,  heading: 0,   destinationName: 'Dibrugarh',  destinationLat: 27.5,  destinationLng: 95.0,  payloadType: 'Water',     priority: 'HIGH',     currentLoadPct: 100, updatedAt: null },
    { id: 'V004', driverName: 'Anita Sharma',  status: 'online',   lat: 25.58, lng: 91.89, speed: 0,  heading: 0,   destinationName: 'Shillong',   destinationLat: 25.57, destinationLng: 91.88, payloadType: 'Meds',      priority: 'HIGH',     currentLoadPct: 70,  updatedAt: null },
    { id: 'V005', driverName: 'Bikash Nath',   status: 'en-route', lat: 24.83, lng: 92.78, speed: 45, heading: 180, destinationName: 'Silchar',    destinationLat: 24.80, destinationLng: 92.75, payloadType: 'Supplies',  priority: 'LOW',      currentLoadPct: 60,  updatedAt: null },
  ];

  const baseTile = layers.terrain
    ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const stormCount = weatherData.filter(w => w.condition === 'storm').length;
  const rainCount  = weatherData.filter(w => w.condition === 'rain' || w.rain > 5).length;

  return (
    <div className="relative">
      {/* Layer Controls */}
      <div className="absolute top-3 right-3 z-[1000] bg-white rounded-xl border border-neutral-200 shadow-md p-3 space-y-2 min-w-[160px]">
        <div className="text-xs font-bold text-neutral-700 mb-2">{t('layers')}</div>
        {(Object.entries(layers) as [keyof typeof layers, boolean][]).map(([key, active]) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-red-50 text-red-700' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-red-500' : 'bg-neutral-300'}`} />
            {key === 'vehicles'  && (t('vehicleLayer')  + ' 🚚')}
            {key === 'weather'   && (t('weatherLayer')  + ' 🌦️')}
            {key === 'disasters' && (t('disasterLayer') + ' ⚠️')}
            {key === 'terrain'   && (t('terrainLayer')  + ' 🏔️')}
          </button>
        ))}
        {/* Weather summary badge */}
        {layers.weather && weatherData.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1">
            {stormCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                <span>⛈️</span><span>{stormCount} storm zone{stormCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {rainCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                <span>🌧️</span><span>{rainCount} rain zone{rainCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {weatherLoading && (
              <div className="text-[10px] text-neutral-400 text-center animate-pulse">Updating...</div>
            )}
          </div>
        )}
      </div>

      <MapContainer center={[26.14, 91.74]} zoom={7} className="w-full" style={{ height: '540px', borderRadius: '12px' }}>
        <TileLayer url={baseTile} attribution="&copy; OpenStreetMap contributors" />

        {displayVehicles.length > 0 && <MapFitBounds vehicles={displayVehicles} />}

        {/* Weather overlay: circles + emoji icons */}
        {layers.weather && weatherData.map((w, i) => (
          <div key={`weather-group-${i}`}>
            <Circle
              center={[w.lat, w.lng]}
              radius={w.condition === 'storm' ? 55000 : 40000}
              pathOptions={{
                fillColor: weatherCircleColor(w),
                fillOpacity: w.condition === 'storm' ? 0.45 : 0.3,
                color: weatherBorderColor(w),
                weight: w.condition === 'storm' ? 2 : w.condition === 'rain' ? 1.5 : 0,
                dashArray: w.condition === 'storm' ? '6 4' : undefined,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <div className="font-bold mb-1 flex items-center gap-2">
                    {w.condition === 'storm' ? '⛈️' : w.condition === 'rain' ? '🌧️' : w.condition === 'fog' ? '🌫️' : '☀️'}
                    {w.cityName}
                  </div>
                  <div className="space-y-0.5 text-xs text-neutral-600">
                    <div>🌡️ {w.temp.toFixed(1)}°C</div>
                    <div>💧 Rain: {w.rain.toFixed(1)} mm/hr</div>
                    <div>💨 Wind: {w.windSpeed.toFixed(0)} km/h</div>
                    <div className={`font-semibold mt-1 ${w.condition === 'storm' ? 'text-purple-700' : w.condition === 'rain' ? 'text-blue-700' : 'text-green-700'}`}>
                      {w.condition.charAt(0).toUpperCase() + w.condition.slice(1)}
                    </div>
                  </div>
                </div>
              </Popup>
            </Circle>
            <Marker position={[w.lat, w.lng]} icon={makeWeatherIcon(w.condition, w.rain, w.windSpeed)}>
              <Popup>
                <div className="text-sm">
                  <div className="font-bold mb-1">{w.cityName}</div>
                  <div className="text-xs text-neutral-600">🌡️ {w.temp.toFixed(1)}°C · {w.condition}</div>
                </div>
              </Popup>
            </Marker>
          </div>
        ))}

        {/* Disaster markers */}
        {layers.disasters && disasters.map(d => (
          <Circle
            key={d.id}
            center={[d.lat, d.lng]}
            radius={25000}
            pathOptions={{ fillColor: '#F97316', fillOpacity: 0.3, color: '#EA580C', weight: 1.5 }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-orange-700 mb-1">⚠️ {d.type.toUpperCase()}</div>
                <div className="text-neutral-700">{d.title}</div>
                <div className="text-xs text-neutral-500 mt-1">Severity: {(d.severity * 10).toFixed(1)}</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* SOS Alert markers */}
        {sosAlerts.filter(alert => typeof alert.lat === 'number' && typeof alert.lng === 'number').map(alert => (
          <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={makeSOSIcon()}>
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-red-700 mb-1">🚨 SOS — {alert.severity}</div>
                <div className="font-medium">{alert.driverName}</div>
                <div className="text-neutral-600 mt-1">{alert.message}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Vehicle markers */}
        {layers.vehicles && displayVehicles.map(v => (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={makeVehicleIcon(v.priority)}>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-bold text-neutral-900 mb-2">🚚 {v.driverName}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-neutral-500">Vehicle</span><span className="font-medium">{v.id}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Status</span><span className="font-medium capitalize">{v.status}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Payload</span><span className="font-medium">{v.payloadType}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Destination</span><span className="font-medium">{v.destinationName}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Speed</span><span className="font-medium">{v.speed} km/h</span></div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Priority</span>
                    <span className="font-bold" style={{ color: PRIORITY_COLORS[v.priority] }}>{v.priority}</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-neutral-500 mb-1">Load {v.currentLoadPct}%</div>
                    <div className="h-1.5 bg-neutral-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${v.currentLoadPct}%`, background: v.currentLoadPct > 90 ? '#DC2626' : v.currentLoadPct > 70 ? '#F59E0B' : '#16A34A' }} />
                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-600">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600" /> High Priority</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Moderate Priority</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-600" /> Low Priority</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400 opacity-70" /> Rain Zone</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-400 opacity-70" /> Disaster Zone</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500 opacity-70" /> Storm Zone</div>
      </div>
    </div>
  );
}
