import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

if (typeof window !== 'undefined') {
  // Fix default icon issue with webpack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function makeEmojiIcon(emoji: string, bg: string) {
  return L.divIcon({
    html: `<div style="background:${bg};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    className: '',
  });
}

const vehicleIcon = makeEmojiIcon('🚚', '#2563eb');
const incidentHighIcon = makeEmojiIcon('⚠️', '#dc2626');
const incidentMedIcon = makeEmojiIcon('⚠️', '#d97706');
const incidentLowIcon = makeEmojiIcon('⚠️', '#65a30d');

interface Vehicle {
  id: number;
  driver_name: string;
  status: string;
  payload_type: string;
  priority: string;
  location: { lat: number; lng: number };
  destination_name: string;
  eta_hours: number;
  current_load_pct: number;
}

interface Incident {
  id: number;
  incident_type: string;
  severity: string;
  verified: boolean;
  location: { lat: number; lng: number };
  description: string;
  confidence_pct: number;
  created_at: string;
}

interface RoadSegment {
  id: number;
  name: string;
  district: string;
  start?: { lat: number; lng: number };
  end?: { lat: number; lng: number };
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
  current_risk_score: number;
  risk_label: string;
  rainfall_factor: number;
  slope_risk: number;
  incident_factor: number;
  traffic_factor: number;
  road_condition_score: number;
  is_critical_corridor: boolean;
  blocked: boolean;
}

export default function LiveMap() {
  if (typeof window === 'undefined') return null;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchAll = async () => {
    try {
      const [vRes, iRes, sRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/road-segments`),
      ]);
      const [vData, iData, sData] = await Promise.all([vRes.json(), iRes.json(), sRes.json()]);
      setVehicles(Array.isArray(vData) ? vData : []);
      setIncidents(Array.isArray(iData) ? iData : []);
      setSegments(Array.isArray(sData) ? sData : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('LiveMap fetch error:', e);
    }
  };

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 15000);
    return () => clearInterval(timer);
  }, []);

  function getSegmentColor(seg: RoadSegment): string {
    if (seg.blocked) return '#7f1d1d';
    if (seg.risk_label === 'HIGH') return '#dc2626';
    if (seg.risk_label === 'MODERATE') return '#f97316';
    return '#22c55e';
  }

  function getIncidentIcon(inc: Incident) {
    const sev = String(inc.severity || '').toUpperCase();
    if (sev === 'HIGH' || sev === '5' || sev === '4') return incidentHighIcon;
    if (sev === 'MEDIUM' || sev === '3') return incidentMedIcon;
    return incidentLowIcon;
  }

  function formatEta(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  return (
    <div style={{ height: '75vh', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #374151' }}>
      <div className="absolute top-2 right-2 z-[1000] bg-gray-900 text-gray-300 text-xs px-3 py-1 rounded-full border border-gray-700">
        🔄 Updated: {lastUpdated}
      </div>
      <MapContainer
        center={[26.0, 92.0]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Road Segments */}
        {segments.map((seg) => {
          const sLat = Number(seg.start?.lat ?? seg.start_lat);
          const sLng = Number(seg.start?.lng ?? seg.start_lng);
          const eLat = Number(seg.end?.lat ?? seg.end_lat);
          const eLng = Number(seg.end?.lng ?? seg.end_lng);

          if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
            return null;
          }

          return (
            <Polyline
              key={seg.id}
              positions={[
                [sLat, sLng],
                [eLat, eLng],
              ]}
              pathOptions={{
                color: getSegmentColor(seg),
                weight: seg.is_critical_corridor ? 8 : 5,
                opacity: seg.risk_label === 'HIGH' ? 0.9 : 0.75,
                dashArray: seg.blocked ? '10,10' : undefined,
              }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    🛣️ {seg.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
                    District: {seg.district}
                    {seg.is_critical_corridor && (
                      <span style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>
                        CRITICAL
                      </span>
                    )}
                    {seg.blocked && (
                      <span style={{ marginLeft: 6, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4 }}>
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: seg.risk_label === 'HIGH' ? '#dc2626' : seg.risk_label === 'MODERATE' ? '#f97316' : '#22c55e' }}>
                    Risk Score: {seg.current_risk_score}/100 {seg.risk_label === 'HIGH' ? '🔴' : seg.risk_label === 'MODERATE' ? '🟡' : '🟢'}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div>🌧️ Rainfall Factor: +{seg.rainfall_factor}</div>
                    <div>⛰️ Slope Risk: +{seg.slope_risk}</div>
                    <div>⚠️ Incident Factor: +{seg.incident_factor}</div>
                    <div>🚗 Traffic Factor: +{seg.traffic_factor}</div>
                    <div>🛣️ Road Condition: +{seg.road_condition_score}</div>
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Vehicles */}
        {vehicles.map((v) => {
          const vLat = Number(v.location?.lat);
          const vLng = Number(v.location?.lng);
          if (isNaN(vLat) || isNaN(vLng)) return null;

          return (
            <Marker key={v.id} position={[vLat, vLng]} icon={vehicleIcon}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    🚚 Vehicle #{v.id}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <div><b>Driver:</b> {v.driver_name}</div>
                    <div><b>Cargo:</b> {v.payload_type}</div>
                    <div>
                      <b>Priority:</b>{' '}
                      <span style={{ color: String(v.priority || '').toUpperCase() === 'CRITICAL' ? '#dc2626' : String(v.priority || '').toUpperCase() === 'HIGH' ? '#f97316' : '#22c55e', fontWeight: 700 }}>
                        {v.priority}
                      </span>
                    </div>
                    <div><b>Status:</b> {v.status}</div>
                    <div><b>Destination:</b> {v.destination_name}</div>
                    <div><b>ETA:</b> {formatEta(v.eta_hours)}</div>
                    <div>
                      <b>Load:</b> {v.current_load_pct}%
                      <div style={{ marginTop: 2, background: '#e5e7eb', borderRadius: 4, height: 6 }}>
                        <div style={{ background: v.current_load_pct > 80 ? '#dc2626' : '#22c55e', width: `${v.current_load_pct}%`, height: 6, borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Incidents */}
        {incidents.map((inc) => {
          const iLat = Number(inc.location?.lat);
          const iLng = Number(inc.location?.lng);
          if (isNaN(iLat) || isNaN(iLng)) return null;

          return (
            <Marker key={inc.id} position={[iLat, iLng]} icon={getIncidentIcon(inc)}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    ⚠️ {inc.incident_type}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <div><b>Severity:</b> {inc.severity}</div>
                    <div><b>Verified:</b> {inc.verified ? '✅ Yes' : '❌ No'}</div>
                    <div><b>Confidence:</b> {inc.confidence_pct}%</div>
                    <div><b>Description:</b> {inc.description}</div>
                    <div><b>Reported:</b> {new Date(inc.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
