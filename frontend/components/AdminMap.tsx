import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const DefaultIcon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const hazardIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const weatherIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png', shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } }); return null;
}

export default function AdminMap() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [draftIncident, setDraftIncident] = useState<{lat: number, lng: number} | null>(null);
  const [incidentType, setIncidentType] = useState("LANDSLIDE");
  const [severity, setSeverity] = useState(5);
  
  // Copilot State
  const [chatOpen, setChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);

  const fetchMapData = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles`).then(res => res.json()).then(setVehicles);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`).then(res => res.json()).then(setIncidents);
  };

  useEffect(() => { fetchMapData(); }, []);

  const submitIncident = async () => {
    if (!draftIncident) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_type: incidentType, severity, lat: draftIncident.lat, lng: draftIncident.lng })
      });
      setDraftIncident(null); fetchMapData();
    } catch (error) { console.error(error); }
  };

  const simulateWeather = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_type: "WEATHER", severity: 3, lat: 26.5, lng: 92.5 })
      });
      fetchMapData();
    } catch (e) {}
  };

  const sendQuery = async () => {
    if(!query) return;
    setMessages(prev => [...prev, {role: "user", text: query}]);
    setQuery("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query})
      });
      const data = await res.json();
      setMessages(prev => [...prev, {role: "ai", text: data.response}]);
    } catch(e) {}
  }

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex gap-4">
        <button onClick={simulateWeather} className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 font-bold">
          🌧️ Simulate Weather Alert
        </button>
        <button onClick={() => setChatOpen(!chatOpen)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-bold ml-auto">
          🤖 AI Copilot
        </button>
      </div>

      {draftIncident && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex flex-wrap items-center gap-4">
          <div><p className="font-semibold text-red-700">Report Hazard</p><p className="text-sm text-gray-600">Lat: {draftIncident.lat.toFixed(4)}, Lng: {draftIncident.lng.toFixed(4)}</p></div>
          <select value={incidentType} onChange={e => setIncidentType(e.target.value)} className="border p-2 rounded">
            <option value="LANDSLIDE">Landslide</option><option value="FLOOD">Flood</option><option value="ROAD_BLOCK">Road Blocked</option>
          </select>
          <input type="number" min="1" max="5" value={severity} onChange={e => setSeverity(parseInt(e.target.value))} className="border p-2 rounded w-20" title="Severity (1-5)" />
          <button onClick={submitIncident} className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700">Submit</button>
          <button onClick={() => setDraftIncident(null)} className="text-gray-500 underline ml-auto">Cancel</button>
        </div>
      )}

      <div style={{ height: '75vh', width: '100%', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ccc' }}>
        <MapContainer center={[26.14, 91.73]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <MapClickHandler onMapClick={(lat, lng) => setDraftIncident({lat, lng})} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {draftIncident && <Marker position={[draftIncident.lat, draftIncident.lng]} opacity={0.6}><Popup>Draft Hazard</Popup></Marker>}
          
          {vehicles.map(v => (
            <Marker key={v.id} position={[v.location.lat, v.location.lng]}>
              <Popup><b>Vehicle:</b> {v.driver_name}<br/><b>Cargo:</b> {v.payload_type}<br/><b>Priority:</b> <span className={v.priority === 'Critical' ? 'text-red-600 font-bold' : ''}>{v.priority}</span></Popup>
            </Marker>
          ))}
          
          {incidents.map(i => (
            <Marker key={i.id} position={[i.location.lat, i.location.lng]} icon={i.incident_type === 'WEATHER' ? weatherIcon : hazardIcon}>
              <Popup><b>{i.incident_type}</b><br/>Severity: {i.severity}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {chatOpen && (
        <div className="absolute top-16 right-4 w-80 bg-white border border-gray-300 rounded-lg shadow-2xl flex flex-col z-[1000] overflow-hidden" style={{height: '60vh'}}>
          <div className="bg-blue-600 text-white p-3 font-bold flex justify-between"><span>Logistics AI Copilot</span><button onClick={()=>setChatOpen(false)}>×</button></div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
             {messages.length === 0 && <p className="text-sm text-gray-500 text-center mt-10">Ask me about critical deliveries, weather impacts, or route risks.</p>}
             {messages.map((m, idx) => (
                <div key={idx} className={`p-2 rounded max-w-[85%] text-sm ${m.role === 'ai' ? 'bg-white border self-start' : 'bg-blue-100 self-end'}`}>
                  {m.text}
                </div>
             ))}
          </div>
          <div className="p-2 border-t bg-white flex">
            <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendQuery()} className="flex-1 border rounded p-2 text-sm" placeholder="Ask AI..." />
            <button onClick={sendQuery} className="ml-2 bg-blue-600 text-white px-3 py-1 rounded">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
