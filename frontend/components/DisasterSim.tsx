'use client';
import { useState } from 'react';

interface SimResult {
  affected_districts: string[];
  affected_vehicles: number;
  critical_shipments_at_risk: number;
  estimated_delays_hours: { min: number; max: number } | number[];
  available_alternatives: number;
  supply_shortage_warnings: string[];
}

function toCount(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'count' in (val as Record<string, unknown>)) {
    const c = (val as Record<string, unknown>).count;
    if (typeof c === 'number') return c;
  }
  if (Array.isArray(val)) return val.length;
  return 0;
}

export default function DisasterSim() {
  const [rainfall, setRainfall] = useState(40);
  const [blockedRoads, setBlockedRoads] = useState(2);
  const [traffic, setTraffic] = useState(50);
  const [supplyMultiplier, setSupplyMultiplier] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState('');

  const runScenario = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rainfall_intensity: rainfall,
          blocked_roads_count: blockedRoads,
          traffic_level: traffic,
          supply_demand_multiplier: supplyMultiplier,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run simulation.');
    } finally {
      setLoading(false);
    }
  };

  function getDelayText(delays: { min: number; max: number } | number[]): string {
    if (Array.isArray(delays)) {
      if (delays.length >= 2) return `${delays[0]}–${delays[delays.length - 1]}h`;
      return `${delays[0]}h`;
    }
    if (delays && typeof delays === 'object' && 'min' in delays) {
      return `${delays.min}–${delays.max}h`;
    }
    return `${delays}h`;
  }

  function getRainfallLabel(v: number) {
    if (v < 30) return { label: 'Light', color: 'text-green-400' };
    if (v < 60) return { label: 'Moderate', color: 'text-yellow-400' };
    if (v < 80) return { label: 'Heavy', color: 'text-orange-400' };
    return { label: 'Extreme', color: 'text-red-400' };
  }

  const rainfallInfo = getRainfallLabel(rainfall);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-red-900 to-orange-900 px-6 py-4 border-b border-red-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <h2 className="text-white font-bold text-lg">Disaster Simulation Engine</h2>
            <p className="text-orange-300 text-xs">Model disaster scenarios and predict cascading impacts</p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sliders */}
        <div className="space-y-8">
          <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Scenario Parameters</h3>

          {/* Rainfall */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-gray-300 font-medium flex items-center gap-2">
                🌧️ Rainfall Intensity
              </label>
              <span className={`text-sm font-bold ${rainfallInfo.color}`}>
                {rainfall}% — {rainfallInfo.label}
              </span>
            </div>
            <input
              type="range" min={0} max={100} value={rainfall}
              onChange={(e) => setRainfall(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#f97316' }}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>0 — None</span><span>50 — Heavy</span><span>100 — Extreme</span>
            </div>
          </div>

          {/* Blocked Roads */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-gray-300 font-medium flex items-center gap-2">
                🚧 Blocked Roads Count
              </label>
              <span className="text-orange-400 font-bold text-sm">{blockedRoads} roads</span>
            </div>
            <input
              type="range" min={0} max={10} value={blockedRoads}
              onChange={(e) => setBlockedRoads(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#f97316' }}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>0</span><span>5</span><span>10</span>
            </div>
          </div>

          {/* Traffic Level */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-gray-300 font-medium flex items-center gap-2">
                🚗 Traffic Level
              </label>
              <span className="text-yellow-400 font-bold text-sm">{traffic}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={traffic}
              onChange={(e) => setTraffic(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#eab308' }}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>0 — Clear</span><span>50 — Congested</span><span>100 — Gridlock</span>
            </div>
          </div>

          {/* Supply Demand Multiplier */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-gray-300 font-medium flex items-center gap-2">
                📦 Supply Demand Multiplier
              </label>
              <span className="text-blue-400 font-bold text-sm">{supplyMultiplier}×</span>
            </div>
            <input
              type="range" min={1} max={3} step={0.5} value={supplyMultiplier}
              onChange={(e) => setSupplyMultiplier(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#3b82f6' }}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>1× Normal</span><span>2× High</span><span>3× Crisis</span>
            </div>
          </div>

          {/* Scenario Preview */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Scenario Summary</p>
            <p className="text-gray-300 text-sm">
              {rainfall > 60 ? '⛈️ Severe flooding conditions' : rainfall > 30 ? '🌧️ Moderate rainfall' : '☁️ Light weather'}{' '}
              with {blockedRoads} road blockages, {traffic > 70 ? 'heavy' : traffic > 40 ? 'moderate' : 'light'} traffic,
              and {supplyMultiplier}× demand surge.
            </p>
          </div>

          <button
            onClick={runScenario}
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-lg shadow-lg flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running Simulation...
              </>
            ) : (
              <>🚀 RUN SCENARIO</>
            )}
          </button>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Impact Assessment</h3>

          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-700 rounded-xl">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-gray-500">Configure parameters and run a scenario to see projected impact</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-700 rounded-xl">
              <div className="text-4xl mb-3 animate-pulse">🔄</div>
              <p className="text-gray-400 font-semibold">Simulating scenario...</p>
              <p className="text-gray-600 text-sm mt-1">Running cascading impact analysis</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Big numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-900/40 border border-red-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-red-400">
                    {result.affected_districts?.length ?? 0}
                  </div>
                  <div className="text-xs text-red-300 mt-1">Districts Affected</div>
                </div>
                <div className="bg-orange-900/40 border border-orange-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-orange-400">{toCount(result.affected_vehicles)}</div>
                  <div className="text-xs text-orange-300 mt-1">Vehicles Affected</div>
                </div>
                <div className="bg-yellow-900/40 border border-yellow-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black text-yellow-400">{toCount(result.critical_shipments_at_risk)}</div>
                  <div className="text-xs text-yellow-300 mt-1">Critical at Risk</div>
                </div>
              </div>

              {/* Delays & Alternatives */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs mb-1">⏱️ Estimated Delays</div>
                  <div className="text-2xl font-bold text-white">{getDelayText(result.estimated_delays_hours)}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs mb-1">🔄 Alternative Routes</div>
                  <div className="text-2xl font-bold text-green-400">{result.available_alternatives}</div>
                </div>
              </div>

              {/* Affected Districts */}
              {result.affected_districts?.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">🗺️ Affected Districts</div>
                  <div className="flex flex-wrap gap-2">
                    {result.affected_districts.map((d) => (
                      <span key={d} className="bg-red-900/50 text-red-300 border border-red-800 px-3 py-1 rounded-full text-xs font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Supply Shortage Warnings */}
              {Array.isArray(result.supply_shortage_warnings) && result.supply_shortage_warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">🚨 Supply Shortage Warnings</div>
                  {result.supply_shortage_warnings.map((warning: any, i: number) => (
                    <div key={i} className="bg-red-900/40 border border-red-700 rounded-lg p-3 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">⚠️</span>
                      <p className="text-red-300 text-sm">
                        {typeof warning === 'string'
                          ? warning
                          : warning?.recommendation
                          || `${warning?.warehouse || 'Warehouse'} (${warning?.district || 'District'}): Low stock`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
