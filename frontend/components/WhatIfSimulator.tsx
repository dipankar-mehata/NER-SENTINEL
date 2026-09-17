'use client';
import { useState, useEffect } from 'react';

interface RoadSegment {
  id: number;
  name: string;
  district: string;
  current_risk_score: number;
  risk_label: string;
  is_critical_corridor: boolean;
  blocked: boolean;
}

interface WhatIfResult {
  affected_vehicles: { id: number; driver_name: string; payload_type: string; priority: string }[];
  affected_shipments: number;
  districts_cut_off: string[];
  new_etas: Record<string, number>;
  supply_impact?: string;
}

export default function WhatIfSimulator() {
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [selected, setSelected] = useState<RoadSegment | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/road-segments`)
      .then((r) => r.json())
      .then((data) => setSegments(Array.isArray(data) ? data : []))
      .catch(() => setSegments([]));
  }, []);

  const runWhatIf = async (seg: RoadSegment) => {
    setSelected(seg);
    setResult(null);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/whatif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_id: seg.id }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run What-If analysis.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelected(null);
    setResult(null);
    setError('');
  };

  function formatEta(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  function getRiskBadge(seg: RoadSegment) {
    if (seg.blocked) return <span className="text-xs bg-red-900 text-red-300 border border-red-700 px-2 py-0.5 rounded">BLOCKED</span>;
    if (seg.risk_label === 'HIGH') return <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded">HIGH</span>;
    if (seg.risk_label === 'MODERATE') return <span className="text-xs bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded">MODERATE</span>;
    return <span className="text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded">LOW</span>;
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4 border-b border-purple-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h2 className="text-white font-bold text-lg">What-If Simulator</h2>
            <p className="text-purple-300 text-xs">Select a road segment to close and see cascading impact</p>
          </div>
          {selected && (
            <button
              onClick={reset}
              className="ml-auto bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg transition-all"
            >
              🔄 Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment List */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">
            Road Segments ({segments.length}) — Click to Simulate Closure
          </h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {segments.length === 0 && (
              <div className="text-gray-600 text-sm text-center py-8">Loading road segments...</div>
            )}
            {segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => runWhatIf(seg)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected?.id === seg.id
                    ? 'bg-purple-900/50 border-purple-500 ring-1 ring-purple-500'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm truncate">{seg.name}</span>
                      {seg.is_critical_corridor && (
                        <span className="text-xs bg-yellow-900/60 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded flex-shrink-0">
                          ⭐ CRITICAL
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{seg.district}</div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {getRiskBadge(seg)}
                    <span className="text-gray-400 text-xs">Risk: {seg.current_risk_score}/100</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Impact Analysis</h3>

          {!selected && (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-700 rounded-xl">
              <div className="text-4xl mb-3">🛣️</div>
              <p className="text-gray-500 text-sm">Click a road segment on the left to simulate its closure</p>
            </div>
          )}

          {selected && loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-700 rounded-xl">
              <div className="text-4xl mb-3 animate-pulse">⚡</div>
              <p className="text-gray-400 font-semibold">Analyzing impact...</p>
              <p className="text-gray-600 text-xs mt-1">Calculating cascading effects of closing {selected.name}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          {result && selected && (() => {
            const vehicleList: any[] = Array.isArray(result.affected_vehicles)
              ? result.affected_vehicles
              : (result.affected_vehicles as any)?.vehicles ?? [];

            const vehicleCount: number = typeof (result.affected_vehicles as any)?.count === 'number'
              ? (result.affected_vehicles as any).count
              : vehicleList.length;

            const shipmentCount: number = typeof result.affected_shipments === 'number'
              ? result.affected_shipments
              : typeof (result.affected_shipments as any)?.count === 'number'
              ? (result.affected_shipments as any).count
              : Array.isArray(result.affected_shipments)
              ? (result.affected_shipments as any).length
              : Array.isArray((result as any)?.affected_shipments_list)
              ? (result as any).affected_shipments_list.length
              : 0;

            const districtsCutOff: string[] = Array.isArray(result.districts_cut_off)
              ? result.districts_cut_off
              : [];

            return (
            <div className="space-y-4">
              {/* Closed segment banner */}
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-4">
                <div className="text-red-400 text-xs uppercase tracking-wider mb-1">Simulating closure of</div>
                <div className="text-white font-bold">{selected.name}</div>
                <div className="text-red-300 text-xs mt-0.5">{selected.district} — Risk Score: {selected.current_risk_score}/100</div>
              </div>

              {/* Big numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-orange-900/40 border border-orange-800 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-orange-400">{vehicleCount}</div>
                  <div className="text-xs text-orange-300 mt-1">Vehicles</div>
                </div>
                <div className="bg-red-900/40 border border-red-800 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-red-400">{shipmentCount}</div>
                  <div className="text-xs text-red-300 mt-1">Critical Shipments</div>
                </div>
                <div className="bg-purple-900/40 border border-purple-800 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-purple-400">{districtsCutOff.length}</div>
                  <div className="text-xs text-purple-300 mt-1">Districts Cut Off</div>
                </div>
              </div>

              {/* Districts Cut Off */}
              {districtsCutOff.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">🗺️ Districts Cut Off</div>
                  <div className="flex flex-wrap gap-2">
                    {districtsCutOff.map((d) => (
                      <span key={d} className="bg-purple-900/50 text-purple-300 border border-purple-700 px-3 py-1 rounded-full text-xs">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Vehicles */}
              {vehicleList.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">🚚 Affected Vehicles</div>
                  <div className="space-y-2">
                    {vehicleList.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">#{v.id}</span>
                          <span className="text-gray-400">{v.driver_name}</span>
                          <span className="text-gray-500">• {v.payload_type}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${String(v.priority || '').toUpperCase() === 'CRITICAL' ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                          {v.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New ETAs */}
              {result.new_etas && Object.keys(result.new_etas).length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">⏱️ New ETAs (Revised)</div>
                  <div className="space-y-1">
                    {Object.entries(result.new_etas).map(([vehicleId, eta]) => (
                      <div key={vehicleId} className="flex justify-between text-sm">
                        <span className="text-gray-400">Vehicle #{vehicleId}</span>
                        <span className="text-yellow-400 font-medium">{formatEta(Number(eta))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supply Impact */}
              {result.supply_impact && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
                  <div className="text-yellow-400 text-xs uppercase tracking-wider mb-2">📦 Supply Impact</div>
                  {Array.isArray(result.supply_impact) ? (
                    <div className="space-y-2">
                      {result.supply_impact.map((item: any, idx: number) => (
                        <div key={idx} className="text-yellow-300 text-sm">
                          {typeof item === 'string'
                            ? item
                            : `⚠️ ${item.warehouse || ''} (${item.district || ''}): ${item.recommendation || `${item.hours_until_critical || 0}h until critical`}`}
                        </div>
                      ))}
                    </div>
                  ) : typeof result.supply_impact === 'string' ? (
                    <p className="text-yellow-300 text-sm">{result.supply_impact}</p>
                  ) : null}
                </div>
              )}
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
