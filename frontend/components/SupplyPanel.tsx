'use client';
import { useState, useEffect } from 'react';

interface SupplyItem {
  district: string;
  cargo_type: string;
  stock_pct: number;
  hours_to_shortage: number;
  recommendation: string;
}

interface Preposition {
  district?: string;
  cargo_type?: string;
  action?: string;
  priority?: string;
  reason?: string;
  recommendation?: string;
}

function getStockColor(pct: number): { bar: string; text: string; label: string; bg: string } {
  if (pct < 20) return { bar: 'bg-red-500', text: 'text-red-300', label: 'CRITICAL SHORTAGE', bg: 'bg-red-900/40 border-red-700' };
  if (pct < 40) return { bar: 'bg-yellow-500', text: 'text-yellow-300', label: 'LOW STOCK', bg: 'bg-yellow-900/40 border-yellow-700' };
  return { bar: 'bg-green-500', text: 'text-green-300', label: 'ADEQUATE', bg: 'bg-green-900/20 border-green-800' };
}

export default function SupplyPanel() {
  const [supplyStatus, setSupplyStatus] = useState<SupplyItem[]>([]);
  const [prepositions, setPrepositions] = useState<Preposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supplyRes, preposRes] = await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/supply/status`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/supply/preposition`),
        ]);

        if (supplyRes.status === 'fulfilled' && supplyRes.value.ok) {
          const data = await supplyRes.value.json();
          setSupplyStatus(Array.isArray(data) ? data : []);
        }

        if (preposRes.status === 'fulfilled' && preposRes.value.ok) {
          const data = await preposRes.value.json();
          setPrepositions(Array.isArray(data) ? data : []);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load supply data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const critical = supplyStatus.filter((s) => s.stock_pct < 20);
  const low = supplyStatus.filter((s) => s.stock_pct >= 20 && s.stock_pct < 40);
  const adequate = supplyStatus.filter((s) => s.stock_pct >= 40);

  function formatHours(h: number): string {
    if (h >= 24) return `${Math.round(h / 24)}d`;
    return `${Math.round(h)}h`;
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Loading supply data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-900/40 border border-red-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-red-400">{critical.length}</div>
              <div className="text-red-300 text-sm mt-1">Critical Shortages</div>
            </div>
            <div className="bg-yellow-900/40 border border-yellow-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-yellow-400">{low.length}</div>
              <div className="text-yellow-300 text-sm mt-1">Low Stock Warnings</div>
            </div>
            <div className="bg-green-900/40 border border-green-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-green-400">{adequate.length}</div>
              <div className="text-green-300 text-sm mt-1">Districts Adequate</div>
            </div>
          </div>

          {/* Critical Cards */}
          {critical.length > 0 && (
            <div>
              <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="animate-pulse">🚨</span> Critical Shortage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {critical.map((item, i) => {
                  const colors = getStockColor(item.stock_pct);
                  return (
                    <div key={i} className={`border rounded-xl p-4 ${colors.bg}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-bold">{item.district}</div>
                          <div className="text-gray-400 text-xs">{item.cargo_type}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${colors.text} bg-red-900/60`}>
                          {colors.label}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Stock Level</span>
                          <span className={`font-bold ${colors.text}`}>{item.stock_pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors.bar} rounded-full transition-all`}
                            style={{ width: `${item.stock_pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Time to shortage:</span>
                        <span className={`font-bold ${colors.text}`}>{formatHours(item.hours_to_shortage)}</span>
                      </div>
                      {item.recommendation && (
                        <div className="mt-2 text-xs text-gray-400 bg-gray-800/60 rounded p-2">
                          💡 {item.recommendation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Low Stock Cards */}
          {low.length > 0 && (
            <div>
              <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-wider mb-3">
                ⚠️ Low Stock Warning
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {low.map((item, i) => {
                  const colors = getStockColor(item.stock_pct);
                  return (
                    <div key={i} className={`border rounded-xl p-4 ${colors.bg}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-bold">{item.district}</div>
                          <div className="text-gray-400 text-xs">{item.cargo_type}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${colors.text} bg-yellow-900/60`}>
                          {colors.label}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Stock Level</span>
                          <span className={`font-bold ${colors.text}`}>{item.stock_pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${item.stock_pct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Time to shortage:</span>
                        <span className={`font-bold ${colors.text}`}>{formatHours(item.hours_to_shortage)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pre-positioning Recommendations */}
          {prepositions.length > 0 && (
            <div>
              <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider mb-3">
                ✅ Pre-positioning Recommendations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {prepositions.map((prep, i) => (
                  <div key={i} className="bg-green-900/20 border border-green-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-green-400 text-lg flex-shrink-0">📦</span>
                      <div>
                        {prep.district && <div className="text-white font-semibold">{prep.district}</div>}
                        {prep.cargo_type && <div className="text-gray-400 text-xs">{prep.cargo_type}</div>}
                        {(prep.action || prep.recommendation) && (
                          <div className="text-green-300 text-sm mt-1">{prep.action || prep.recommendation}</div>
                        )}
                        {prep.reason && <div className="text-gray-500 text-xs mt-1">{prep.reason}</div>}
                        {prep.priority && (
                          <span className="inline-block mt-2 text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded">
                            Priority: {prep.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {supplyStatus.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No supply data available from the server.
            </div>
          )}
        </>
      )}
    </div>
  );
}
