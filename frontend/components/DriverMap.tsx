import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const DefaultIcon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const hazardIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const weatherIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

const CITIES = [
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Shillong", lat: 25.5788, lng: 91.8839 },
  { name: "Tezpur", lat: 26.6528, lng: 92.7926 },
  { name: "Silchar", lat: 24.8333, lng: 92.7789 },
];

export default function DriverMap() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [destination, setDestination] = useState<string>("Tezpur"); // Default for demo
  
  const [segments, setSegments] = useState<any[]>([]);
  const [totalRisk, setTotalRisk] = useState<number | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`).then(res => res.json()).then(setIncidents);
    
    // Simulate Vehicle #27 starting in Guwahati
    setCurrentLocation({ lat: 26.14, lng: 91.73 });
  }, []);

  const calculateRoute = async (destName: string) => {
    setDestination(destName);
    if (!currentLocation || !destName) return;
    
    const dest = CITIES.find(c => c.name === destName);
    if (!dest) return;

    setLoadingRoute(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/route`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ start_lat: currentLocation.lat, start_lng: currentLocation.lng, end_lat: dest.lat, end_lng: dest.lng })
      });
      const data = await res.json();
      setSegments(data.segments || []);
      setTotalRisk(data.total_risk);
    } catch (err) { console.error(err); }
    setLoadingRoute(false);
  }

  // Auto calculate route on load for demo purposes
  useEffect(() => {
     if(currentLocation && destination) {
         calculateRoute(destination);
     }
  }, [currentLocation]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex flex-wrap items-center gap-4">
        <div>
          <p className="font-semibold text-green-800">Dynamic Risk Navigator</p>
          <p className="text-sm text-gray-600">Vehicle #27 | Critical Medicine</p>
        </div>
        
        <select value={destination} onChange={e => calculateRoute(e.target.value)} className="border p-2 rounded flex-1 min-w-[200px]">
          {CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        
        {totalRisk !== null && !loadingRoute && (
          <div className={`px-4 py-2 rounded font-bold text-white ${totalRisk > 60 ? 'bg-red-600' : totalRisk > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}>
            Risk Score: {totalRisk}/100
          </div>
        )}
        
        {loadingRoute && <span className="text-blue-600 font-semibold animate-pulse">Calculating Safe Route...</span>}
      </div>

      <div style={{ height: '75vh', width: '100%', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ccc' }}>
        <MapContainer center={[26.14, 91.73]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]}><Popup>Vehicle #27</Popup></Marker>}
          {destination && CITIES.find(c => c.name === destination) && <Marker position={[CITIES.find(c => c.name === destination)!.lat, CITIES.find(c => c.name === destination)!.lng]}><Popup>Destination</Popup></Marker>}
          
          {segments.map((seg, idx) => (
             <Polyline key={idx} positions={[[seg.start.lat, seg.start.lng], [seg.end.lat, seg.end.lng]]} color={seg.color} weight={6} />
          ))}

          {incidents.map(i => (
            <Marker key={i.id} position={[i.location.lat, i.location.lng]} icon={i.incident_type === 'WEATHER' ? weatherIcon : hazardIcon}>
              <Popup><b>{i.incident_type}</b><br/>Severity: {i.severity}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
