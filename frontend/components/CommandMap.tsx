import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
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
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
    className: '',
  });
}

function makeSOSIcon() {
  return L.divIcon({
    html: `<div style="position:relative">
      <div style="background:#DC2626;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid white;box-shadow:0 0 0 4px rgba(220,38,38,0.3),0 3px 10px rgba(0,0,0,0.4);animation:sos-pulse 1.4s ease-in-out infinite">🚨</div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
    className: '',
  });
}

// ── Disaster data fetcher ─────────────────────────────────────────
interface DisasterPoint {
  id: string;
  lat: number;
  lng: number;
  type: string;
  title: string;
  severity: number;
}

async function fetchGDACSDisasters(): Promise<DisasterPoint[]> {
  // Use USGS earthquake feed as it's CORS-friendly
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
    const data = await res.json();
    return (data.features || []).slice(0, 20).map((f: any) => ({
      id: f.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      type: 'earthquake',
      title: f.properties.place,
      severity: Math.min(f.properties.mag / 10, 1),
    }));
  } catch {
    return [];
  }
}

// ── Weather overlay point ────────────────────────────────────────
interface WeatherPoint {
  lat: number;
  lng: number;
  temp: number;
  rain: number;
  windSpeed: number;
  condition: string;
}

const NE_WEATHER_GRID = [
  { lat: 26.14, lng: 91.74 }, // Guwahati
  { lat: 26.63, lng: 92.80 }, // Tezpur
  { lat: 26.75, lng: 94.20 }, // Jorhat
  { lat: 27.47, lng: 94.91 }, // Dibrugarh
  { lat: 24.83, lng: 92.78 }, // Silchar
  { lat: 27.08, lng: 93.60 }, // Itanagar
  { lat: 25.58, lng: 91.89 }, // Shillong
  { lat: 24.82, lng: 93.94 }, // Imphal
];

async function fetchWeatherGrid(): Promise<WeatherPoint[]> {
  try {
    const points: WeatherPoint[] = [];
    // Batch fetch Open-Meteo for NE India grid points
    const lats = NE_WEATHER_GRID.map(p => p.lat).join(',');
    const lngs = NE_WEATHER_GRID.map(p => p.lng).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`;
    const res = await fetch(url);
    const data = await res.json();
    // Handle both array and object response
    const results = Array.isArray(data) ? data : [data];
    results.forEach((r: any, i: number) => {
      if (!r.current || !NE_WEATHER_GRID[i]) return;
      const wc = r.current.weather_code || 0;
      points.push({
        lat: NE_WEATHER_GRID[i].lat,
        lng: NE_WEATHER_GRID[i].lng,
        temp: r.current.temperature_2m || 0,
        rain: r.current.precipitation || 0,
        windSpeed: r.current.wind_speed_10m || 0,
        condition: wc >= 95 ? 'storm' : wc >= 61 ? 'rain' : wc >= 45 ? 'fog' : 'clear',
      });
    });
    return points;
  } catch {
    // Return mock weather if API fails
    return NE_WEATHER_GRID.map(p => ({
      ...p,
      temp: 26 + Math.random() * 6,
      rain: Math.random() * 15,
      windSpeed: 10 + Math.random() * 30,
      condition: Math.random() > 0.6 ? 'rain' : 'clear',
    }));
  }
}

function weatherColor(w: WeatherPoint): string {
  if (w.condition === 'storm') return 'rgba(139,92,246,0.35)';
  if (w.condition === 'rain' || w.rain > 5) return 'rgba(59,130,246,0.25)';
  if (w.windSpeed > 40) return 'rgba(249,115,22,0.2)';
  return 'rgba(34,197,94,0.1)';
}

// ── MapFitBounds ─────────────────────────────────────────────────
function MapFitBounds({ vehicles }: { vehicles: FirebaseVehicle[] }) {
  const map = useMap();
  useEffect(() => {
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [vehicles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Main Component ───────────────────────────────────────────────
export default function CommandMap({
  vehicles,
  sosAlerts,
}: {
  vehicles: FirebaseVehicle[];
  sosAlerts: SOSAlert[];
}) {
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([]);
  const [disasters, setDisasters] = useState<DisasterPoint[]>([]);
  const [layers, setLayers] = useState({ vehicles: true, weather: true, disasters: true, terrain: false });

  useEffect(() => {
    fetchWeatherGrid().then(setWeatherData);
    fetchGDACSDisasters().then(setDisasters);
    const interval = setInterval(() => {
      fetchWeatherGrid().then(setWeatherData);
    }, 300_000); // refresh weather every 5 min
    return () => clearInterval(interval);
  }, []);

  const toggleLayer = useCallback((key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Demo vehicles if Firebase not connected
  const displayVehicles: FirebaseVehicle[] = vehicles.length > 0 ? vehicles : [
    { id: 'V001', driverName: 'Rajesh Kumar',  status: 'en-route', lat: 26.14, lng: 91.74, speed: 52, heading: 90,  destinationName: 'Tezpur', destinationLat: 26.63, destinationLng: 92.80, payloadType: 'Medical', priority: 'HIGH',     currentLoadPct: 87, updatedAt: null },
    { id: 'V002', driverName: 'Priya Das',     status: 'en-route', lat: 26.35, lng: 92.68, speed: 38, heading: 45,  destinationName: 'Jorhat', destinationLat: 26.75, destinationLng: 94.20, payloadType: 'Food',    priority: 'MODERATE', currentLoadPct: 95, updatedAt: null },
    { id: 'V003', driverName: 'Mohan Singh',   status: 'stopped',  lat: 27.47, lng: 94.91, speed: 0,  heading: 0,   destinationName: 'Dibrugarh', destinationLat: 27.5, destinationLng: 95.0, payloadType: 'Water',  priority: 'HIGH',     currentLoadPct: 100, updatedAt: null },
    { id: 'V004', driverName: 'Anita Sharma',  status: 'online',   lat: 25.58, lng: 91.89, speed: 0,  heading: 0,   destinationName: 'Shillong', destinationLat: 25.57, destinationLng: 91.88, payloadType: 'Meds',  priority: 'HIGH',     currentLoadPct: 70, updatedAt: null },
    { id: 'V005', driverName: 'Bikash Nath',   status: 'en-route', lat: 24.83, lng: 92.78, speed: 45, heading: 180, destinationName: 'Silchar', destinationLat: 24.80, destinationLng: 92.75, payloadType: 'Supplies', priority: 'LOW', currentLoadPct: 60, updatedAt: null },
  ];

  const baseTile = layers.terrain
    ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = layers.terrain
    ? '&copy; OpenTopoMap contributors'
    : '&copy; OpenStreetMap contributors';

  return (
    <div className="relative">
      {/* Layer Controls */}
      <div className="absolute top-3 right-3 z-[1000] bg-white rounded-xl border border-neutral-200 shadow-md p-3 space-y-2">
        <div className="text-xs font-bold text-neutral-700 mb-2">{t('layers')}</div>
        {(Object.entries(layers) as [keyof typeof layers, boolean][]).map(([key, active]) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active ? 'bg-red-50 text-red-700' : 'text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-red-500' : 'bg-neutral-300'}`} />
            {key === 'vehicles' && (t('vehicleLayer') + ' 🚚')}
            {key === 'weather'  && (t('weatherLayer')  + ' 🌦️')}
            {key === 'disasters' && (t('disasterLayer') + ' ⚠️')}
            {key === 'terrain'  && (t('terrainLayer')  + ' 🏔️')}
          </button>
        ))}
      </div>

      <MapContainer
        center={[26.14, 91.74]}
        zoom={7}
        className="w-full"
        style={{ height: '540px', borderRadius: '12px' }}
      >
        <TileLayer url={baseTile} attribution={tileAttribution} />

        {/* Fit to vehicles on load */}
        {displayVehicles.length > 0 && <MapFitBounds vehicles={displayVehicles} />}

        {/* Weather overlay circles */}
        {layers.weather && weatherData.map((w, i) => (
          <Circle
            key={`weather-${i}`}
            center={[w.lat, w.lng]}
            radius={40000}
            pathOptions={{ fillColor: weatherColor(w), fillOpacity: 0.7, color: 'transparent', weight: 0 }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold mb-1">🌡️ {w.temp.toFixed(1)}°C</div>
                <div>💧 Rain: {w.rain.toFixed(1)} mm</div>
                <div>💨 Wind: {w.windSpeed.toFixed(0)} km/h</div>
                <div>☁️ {w.condition}</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Disaster markers */}
        {layers.disasters && disasters.map(d => (
          <Circle
            key={d.id}
            center={[d.lat, d.lng]}
            radius={25000}
            pathOptions={{ fillColor: '#F97316', fillOpacity: 0.35, color: '#EA580C', weight: 2 }}
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
        {sosAlerts.map(alert => (
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
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={makeVehicleIcon(v.priority)}
          >
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-bold text-neutral-900 mb-2">{v.driverName}</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Vehicle</span>
                    <span className="font-medium">{v.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Status</span>
                    <span className="font-medium capitalize">{v.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Payload</span>
                    <span className="font-medium">{v.payloadType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Destination</span>
                    <span className="font-medium">{v.destinationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Speed</span>
                    <span className="font-medium">{v.speed} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Priority</span>
                    <span className="font-bold" style={{ color: PRIORITY_COLORS[v.priority] }}>{v.priority}</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-neutral-500 text-xs mb-1">Load {v.currentLoadPct}%</div>
                    <div className="h-1.5 bg-neutral-100 rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${v.currentLoadPct}%`,
                          background: v.currentLoadPct > 90 ? '#DC2626' : v.currentLoadPct > 70 ? '#F59E0B' : '#16A34A',
                        }}
                      />
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
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600" /> High Priority Vehicle</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Moderate Priority</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-600" /> Low Priority</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400 opacity-60" /> Rain Zone</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-400 opacity-60" /> Disaster Zone</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500 opacity-60" /> Storm Zone</div>
      </div>
    </div>
  );
}
