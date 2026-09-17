'use client';

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

interface VehiclePanelProps {
  vehicles: Vehicle[];
}

function getPriorityStyle(priority: string): string {
  const p = String(priority || '').toUpperCase();
  if (p === 'CRITICAL') return 'bg-red-900/60 text-red-300 border-red-700';
  if (p === 'HIGH') return 'bg-orange-900/60 text-orange-300 border-orange-700';
  if (p === 'MEDIUM') return 'bg-yellow-900/60 text-yellow-300 border-yellow-700';
  return 'bg-green-900/60 text-green-300 border-green-700';
}

function getStatusStyle(status: string): string {
  const s = String(status || '').toUpperCase();
  if (s === 'DELAYED' || s === 'AT_RISK') return 'bg-red-900/60 text-red-300';
  if (s === 'IN_TRANSIT' || s === 'EN_ROUTE') return 'bg-blue-900/60 text-blue-300';
  if (s === 'DELIVERED' || s === 'COMPLETED') return 'bg-green-900/60 text-green-300';
  if (s === 'IDLE' || s === 'WAITING') return 'bg-gray-700 text-gray-400';
  return 'bg-gray-700 text-gray-400';
}

function formatEta(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export default function VehiclePanel({ vehicles }: VehiclePanelProps) {
  return (
    <div className="space-y-2">
      {vehicles.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-8">No vehicles to display.</div>
      )}
      {vehicles.map((v) => (
        <div
          key={v.id}
          className={`bg-gray-800 border rounded-xl p-3 transition-all hover:bg-gray-750 ${
            (v.priority || '').toUpperCase() === 'CRITICAL' ? 'border-red-800' : 'border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">#{v.id}</span>
              <span className="text-white font-medium text-sm">{v.driver_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityStyle(v.priority)}`}>
                {v.priority}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusStyle(v.status)}`}>
                {v.status}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>📦 {v.payload_type}</span>
            <span>→ {v.destination_name}</span>
            <span>⏱️ {formatEta(v.eta_hours)}</span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Load</span>
              <span className={v.current_load_pct > 90 ? 'text-red-400' : v.current_load_pct > 70 ? 'text-orange-400' : 'text-gray-400'}>
                {v.current_load_pct}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  v.current_load_pct > 90 ? 'bg-red-500' : v.current_load_pct > 70 ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                style={{ width: `${v.current_load_pct}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
