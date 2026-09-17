import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import WeatherWidget from '../../components/WeatherWidget';

interface District {
  id: number;
  name: string;
  accessibility_score: number;
  active_incidents_count: number;
  blocked_routes_count: number;
  critical_routes_count: number;
}

interface RoadSegment {
  id: number;
  name: string;
  district: string;
  current_risk_score: number;
  risk_label: string;
  is_critical_corridor: boolean;
  blocked: boolean;
  rainfall_factor: number;
  slope_risk: number;
}

interface Incident {
  id: number;
  incident_type: string;
  severity: string;
  description: string;
  verified: boolean;
  created_at: string;
}

interface WeatherZone {
  temperature_c: number;
  rainfall_mm_hr: number;
  condition: string;
  humidity_pct: number;
  forecast_24h?: string;
}

type WeatherData = Record<string, WeatherZone>;

function getScoreStyle(score: number) {
  if (score >= 70) return { text: 'text-green-400', ring: 'ring-green-500', bg: 'bg-green-900/20' };
  if (score >= 40) return { text: 'text-yellow-400', ring: 'ring-yellow-500', bg: 'bg-yellow-900/20' };
  return { text: 'text-red-400', ring: 'ring-red-500', bg: 'bg-red-900/20' };
}

function getRiskBadge(label: string) {
  if (label === 'HIGH') return 'bg-red-900/60 text-red-300';
  if (label === 'MODERATE') return 'bg-yellow-900/60 text-yellow-300';
  return 'bg-green-900/60 text-green-300';
}

export default function DistrictPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [weather, setWeather] = useState<WeatherData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dRes, sRes, iRes, wRes] = await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/districts`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/road-segments`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/weather`),
        ]);

        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const d = await dRes.value.json();
          const arr: District[] = Array.isArray(d) ? d : [];
          setDistricts(arr);
          if (arr.length > 0) setSelectedDistrict(arr[0]);
        }
        if (sRes.status === 'fulfilled' && sRes.value.ok) {
          const d = await sRes.value.json();
          setSegments(Array.isArray(d) ? d : []);
        }
        if (iRes.status === 'fulfilled' && iRes.value.ok) {
          const d = await iRes.value.json();
          setIncidents(Array.isArray(d) ? d : []);
        }
        if (wRes.status === 'fulfilled' && wRes.value.ok) {
          const d = await wRes.value.json();
          setWeather(d || {});
        }
      } catch {
        // Silently continue
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const districtSegments = selectedDistrict
    ? segments.filter((s) => s.district?.toLowerCase() === selectedDistrict.name?.toLowerCase())
    : [];

  const districtIncidents = selectedDistrict ? incidents.slice(0, 6) : [];

  const districtWeatherKey = selectedDistrict
    ? Object.keys(weather).find((k) => k.toLowerCase().includes(selectedDistrict.name.toLowerCase().split(' ')[0]))
    : null;
  const districtWeatherData = districtWeatherKey ? weather[districtWeatherKey] : undefined;

  const scoreStyle = selectedDistrict ? getScoreStyle(selectedDistrict.accessibility_score) : null;

  return (
    <>
      <Head>
        <title>District Officer — NER-SENTINEL</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-lg">🗺️</span>
          <span className="font-black text-white tracking-wider text-sm">DISTRICT OFFICER DASHBOARD</span>
        </header>

        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* District Selector */}
          <div className="flex items-center gap-4">
            <label className="text-gray-400 text-sm">Select District:</label>
            <select
              value={selectedDistrict?.id ?? ''}
              onChange={(e) => {
                const d = districts.find((d) => d.id === Number(e.target.value));
                if (d) setSelectedDistrict(d);
              }}
              className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-purple-500 min-w-48"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {loading && <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />}
          </div>

          {selectedDistrict && scoreStyle && (
            <>
              {/* Score + Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Big Score Gauge */}
                <div className={`${scoreStyle.bg} border border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center md:col-span-1`}>
                  <div className={`w-24 h-24 rounded-full ring-4 ${scoreStyle.ring} flex items-center justify-center mb-3`}>
                    <span className={`text-3xl font-black ${scoreStyle.text}`}>
                      {selectedDistrict.accessibility_score}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs text-center">Accessibility Score</div>
                  <div className={`text-xs font-bold mt-1 ${scoreStyle.text}`}>
                    {selectedDistrict.accessibility_score >= 70 ? 'ACCESSIBLE' :
                     selectedDistrict.accessibility_score >= 40 ? 'AT RISK' : 'CRITICAL'}
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-orange-900/30 border border-orange-800 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-orange-400">{selectedDistrict.active_incidents_count}</div>
                    <div className="text-orange-300 text-xs mt-1">Active Incidents</div>
                  </div>
                  <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-red-400">{selectedDistrict.blocked_routes_count}</div>
                    <div className="text-red-300 text-xs mt-1">Blocked Routes</div>
                  </div>
                  <div className="bg-yellow-900/30 border border-yellow-800 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-yellow-400">{selectedDistrict.critical_routes_count}</div>
                    <div className="text-yellow-300 text-xs mt-1">Critical Routes</div>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-blue-400">{districtSegments.length}</div>
                    <div className="text-blue-300 text-xs mt-1">Road Segments</div>
                  </div>
                </div>
              </div>

              {/* Road Segments Table + Weather */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Road Segments Table */}
                <div className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-white font-bold text-sm">🛣️ Road Segments — {selectedDistrict.name}</h3>
                  </div>
                  {districtSegments.length === 0 ? (
                    <div className="p-6 text-center text-gray-600 text-sm">
                      No road segment data for this district
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="text-left px-4 py-2">Segment</th>
                            <th className="text-center px-4 py-2">Risk</th>
                            <th className="text-center px-4 py-2">Status</th>
                            <th className="text-right px-4 py-2">Rainfall</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {districtSegments.map((seg) => (
                            <tr key={seg.id} className="hover:bg-gray-800/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-white font-medium">{seg.name}</div>
                                {seg.is_critical_corridor && (
                                  <div className="text-yellow-400 text-xs">⭐ Critical Corridor</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs px-2 py-1 rounded-full ${getRiskBadge(seg.risk_label)}`}>
                                  {seg.current_risk_score}/100
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {seg.blocked ? (
                                  <span className="text-xs bg-red-900 text-red-300 border border-red-700 px-2 py-0.5 rounded">BLOCKED</span>
                                ) : (
                                  <span className="text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded">OPEN</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                +{seg.rainfall_factor}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Weather + Incidents */}
                <div className="space-y-4">
                  {/* Weather Widget */}
                  <WeatherWidget
                    zoneName={selectedDistrict.name}
                    weatherData={districtWeatherData}
                  />

                  {/* Recent Incidents */}
                  <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <h3 className="text-white font-bold text-sm">⚠️ Recent Incidents</h3>
                    </div>
                    <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
                      {districtIncidents.length === 0 ? (
                        <div className="p-4 text-center text-gray-600 text-sm">No incidents reported</div>
                      ) : (
                        districtIncidents.map((inc) => (
                          <div key={inc.id} className="px-4 py-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="text-white text-sm font-medium">{inc.incident_type}</div>
                                <div className="text-gray-500 text-xs mt-0.5">{inc.description}</div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-xs px-2 py-0.5 rounded ${getRiskBadge(inc.severity)}`}>
                                  {inc.severity}
                                </span>
                                <span className="text-gray-600 text-xs">{inc.verified ? '✅' : '❓'}</span>
                              </div>
                            </div>
                            <div className="text-gray-600 text-xs mt-1">
                              {new Date(inc.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
