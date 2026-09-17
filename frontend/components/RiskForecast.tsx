'use client';
import { useState, useEffect } from 'react';

interface RiskPrediction {
  segment_id: number;
  segment_name: string;
  risk_24h: number;
  risk_48h: number;
  risk_72h: number;
  current_risk?: number;
}

function getRiskColor(score: number): string {
  if (score >= 70) return 'bg-red-900/60 text-red-300';
  if (score >= 40) return 'bg-yellow-900/60 text-yellow-300';
  return 'bg-green-900/60 text-green-300';
}

function getRiskLabel(score: number): string {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

function getTrend(current: number, future: number): { arrow: string; color: string } {
  const diff = future - current;
  if (diff > 5) return { arrow: '↑', color: 'text-red-400' };
  if (diff < -5) return { arrow: '↓', color: 'text-green-400' };
  return { arrow: '→', color: 'text-gray-400' };
}

export default function RiskForecast() {
  const [predictions, setPredictions] = useState<RiskPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/risk-prediction`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPredictions(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load risk predictions.');
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  const criticalAlerts = predictions.filter(
    (p) => (p.current_risk ?? 0) < 70 && p.risk_24h >= 70
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 px-6 py-4 border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔮</span>
          <div>
            <h2 className="text-white font-bold text-lg">24-72h Risk Forecast</h2>
            <p className="text-indigo-300 text-xs">ML-powered risk prediction for all road segments</p>
          </div>
          <div className="ml-auto text-indigo-300 text-xs">
            {predictions.length} segments analyzed
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Critical Alerts Banner */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 text-lg">🚨</span>
              <span className="text-red-300 font-bold">Critical Escalation Warning</span>
            </div>
            <p className="text-red-300 text-sm mb-3">
              {criticalAlerts.length} segment{criticalAlerts.length > 1 ? 's' : ''} projected to escalate from LOW to HIGH risk within 24 hours:
            </p>
            <div className="flex flex-wrap gap-2">
              {criticalAlerts.map((alert) => (
                <span key={alert.segment_id} className="bg-red-900/60 text-red-200 border border-red-700 px-3 py-1 rounded-full text-xs font-medium">
                  ⚠️ {alert.segment_name} → {alert.risk_24h}/100
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400">Loading forecast data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
            ❌ {error}
          </div>
        )}

        {!loading && !error && predictions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Segment</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Current</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">24h Forecast</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">48h Forecast</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">72h Forecast</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {predictions.map((pred) => {
                  const currentRisk = pred.current_risk ?? Math.round((pred.risk_24h + pred.risk_48h + pred.risk_72h) / 3 * 0.85);
                  const trend24 = getTrend(currentRisk, pred.risk_24h);
                  const trend72 = getTrend(currentRisk, pred.risk_72h);
                  const isEscalating = currentRisk < 70 && pred.risk_24h >= 70;

                  return (
                    <tr
                      key={pred.segment_id}
                      className={`transition-colors ${isEscalating ? 'bg-red-900/20' : 'hover:bg-gray-800/50'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-white font-medium">{pred.segment_name}</div>
                            {isEscalating && (
                              <div className="text-red-400 text-xs">🚨 Escalating to HIGH</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(currentRisk)}`}>
                          {currentRisk}/100
                        </span>
                        <div className="text-gray-600 text-xs mt-0.5">{getRiskLabel(currentRisk)}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(pred.risk_24h)}`}>
                            {pred.risk_24h}/100
                          </span>
                          <span className={`text-sm font-bold ${trend24.color}`}>{trend24.arrow}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(pred.risk_48h)}`}>
                          {pred.risk_48h}/100
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(pred.risk_72h)}`}>
                            {pred.risk_72h}/100
                          </span>
                          <span className={`text-sm font-bold ${trend72.color}`}>{trend72.arrow}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-lg font-bold ${trend72.color}`}>{trend72.arrow}</span>
                          <span className={`text-xs ${trend72.color}`}>
                            {trend72.arrow === '↑' ? 'Worsening' : trend72.arrow === '↓' ? 'Improving' : 'Stable'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && predictions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No prediction data available from the server.
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 text-xs text-gray-500 pt-2">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-700 inline-block" /> Low (&lt;40)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-700 inline-block" /> Moderate (40-70)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-700 inline-block" /> High (&gt;70)</span>
          <span className="flex items-center gap-1"><span className="text-red-400">↑</span> Worsening</span>
          <span className="flex items-center gap-1"><span className="text-green-400">↓</span> Improving</span>
          <span className="flex items-center gap-1"><span className="text-gray-400">→</span> Stable</span>
        </div>
      </div>
    </div>
  );
}
