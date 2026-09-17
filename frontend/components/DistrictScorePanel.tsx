'use client';
import { useState, useEffect } from 'react';

interface District {
  id: number;
  name: string;
  accessibility_score: number;
  active_incidents_count: number;
  blocked_routes_count: number;
  critical_routes_count: number;
}

function getScoreStyle(score: number): { ring: string; text: string; bg: string } {
  if (score >= 70) return { ring: 'ring-green-500', text: 'text-green-400', bg: 'bg-green-900/20' };
  if (score >= 40) return { ring: 'ring-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-900/20' };
  return { ring: 'ring-red-500', text: 'text-red-400', bg: 'bg-red-900/20' };
}

export default function DistrictScorePanel() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/districts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDistricts(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load districts.');
      } finally {
        setLoading(false);
      }
    };
    fetchDistricts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
        ❌ {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {districts.map((d) => {
        const style = getScoreStyle(d.accessibility_score);
        return (
          <div
            key={d.id}
            className={`${style.bg} border border-gray-700 rounded-xl p-4 text-center transition-all hover:scale-105`}
          >
            {/* Score Circle */}
            <div className={`mx-auto w-16 h-16 rounded-full ring-4 ${style.ring} flex items-center justify-center mb-3`}>
              <span className={`text-xl font-black ${style.text}`}>{d.accessibility_score}</span>
            </div>

            <div className="text-white font-bold text-sm mb-2">{d.name}</div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>⚠️ Incidents</span>
                <span className={d.active_incidents_count > 0 ? 'text-orange-400 font-bold' : 'text-gray-500'}>
                  {d.active_incidents_count}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>🚧 Blocked</span>
                <span className={d.blocked_routes_count > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}>
                  {d.blocked_routes_count}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>⭐ Critical</span>
                <span className={d.critical_routes_count > 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
                  {d.critical_routes_count}
                </span>
              </div>
            </div>

            <div className={`mt-2 text-xs font-bold ${style.text}`}>
              {d.accessibility_score >= 70 ? 'ACCESSIBLE' : d.accessibility_score >= 40 ? 'AT RISK' : 'CRITICAL'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
