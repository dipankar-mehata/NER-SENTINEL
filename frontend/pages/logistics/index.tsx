import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import SupplyPanel from '../../components/SupplyPanel';

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

type Tab = 'fleet' | 'supply' | 'backhaul';

function formatEta(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
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
  if (s === 'DELAYED' || s === 'AT_RISK') return 'bg-red-900/50 text-red-300';
  if (s === 'IN_TRANSIT' || s === 'EN_ROUTE') return 'bg-blue-900/50 text-blue-300';
  if (s === 'DELIVERED' || s === 'COMPLETED') return 'bg-green-900/50 text-green-300';
  return 'bg-gray-700 text-gray-400';
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'fleet', label: 'Fleet', icon: '🚚' },
  { id: 'supply', label: 'Supply', icon: '📦' },
  { id: 'backhaul', label: 'Backhaul', icon: '🔄' },
];

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('fleet');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setVehicles(Array.isArray(data) ? data : []);
      } catch {
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
    const timer = setInterval(fetchVehicles, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      !searchQuery ||
      v.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.payload_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.destination_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'ALL' || String(v.priority || '').toUpperCase() === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const backhaulCandidates = vehicles.filter((v) => v.current_load_pct < 50);
  const criticalCount = vehicles.filter((v) => String(v.priority || '').toUpperCase() === 'CRITICAL').length;
  const inTransitCount = vehicles.filter((v) =>
    ['IN_TRANSIT', 'EN_ROUTE'].includes(String(v.status || '').toUpperCase())
  ).length;

  return (
    <>
      <Head>
        <title>Logistics Manager — NER-SENTINEL</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-lg">📦</span>
          <span className="font-black text-white tracking-wider text-sm">LOGISTICS MANAGER</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs">Live • 15s refresh</span>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-blue-400">{vehicles.length}</div>
              <div className="text-blue-300 text-xs mt-1">Total Fleet</div>
            </div>
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-red-400">{criticalCount}</div>
              <div className="text-red-300 text-xs mt-1">Critical Priority</div>
            </div>
            <div className="bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-green-400">{inTransitCount}</div>
              <div className="text-green-300 text-xs mt-1">In Transit</div>
            </div>
            <div className="bg-orange-900/30 border border-orange-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-orange-400">{backhaulCandidates.length}</div>
              <div className="text-orange-300 text-xs mt-1">Backhaul Candidates</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-400 bg-orange-900/10'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Fleet Tab */}
          {activeTab === 'fleet' && (
            <div>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search driver, cargo, destination..."
                  className="bg-gray-800 border border-gray-700 text-white placeholder-gray-500 px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-orange-500 flex-1 min-w-48"
                />
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-800 border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-3">ID</th>
                          <th className="text-left px-4 py-3">Driver</th>
                          <th className="text-left px-4 py-3">Cargo</th>
                          <th className="text-center px-4 py-3">Priority</th>
                          <th className="text-center px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Destination</th>
                          <th className="text-center px-4 py-3">ETA</th>
                          <th className="text-center px-4 py-3">Load%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {filteredVehicles.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-gray-600">
                              No vehicles match your filters
                            </td>
                          </tr>
                        ) : (
                          filteredVehicles.map((v) => {
                            const isCritical = String(v.priority || '').toUpperCase() === 'CRITICAL';
                            return (
                              <tr
                                key={v.id}
                                className={`transition-colors ${
                                  isCritical
                                    ? 'bg-red-900/10 hover:bg-red-900/20 border-l-2 border-l-red-600'
                                    : 'hover:bg-gray-800/40'
                                }`}
                              >
                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{v.id}</td>
                                <td className="px-4 py-3 text-white font-medium">{v.driver_name}</td>
                                <td className="px-4 py-3 text-gray-300">{v.payload_type}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityStyle(v.priority)}`}>
                                    {isCritical ? '🔴 ' : ''}{v.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(v.status)}`}>
                                    {v.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300">{v.destination_name}</td>
                                <td className="px-4 py-3 text-center text-gray-300">{formatEta(v.eta_hours)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          v.current_load_pct > 90 ? 'bg-red-500' :
                                          v.current_load_pct > 70 ? 'bg-orange-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${v.current_load_pct}%` }}
                                      />
                                    </div>
                                    <span className="text-gray-400 text-xs w-8">{v.current_load_pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supply Tab */}
          {activeTab === 'supply' && <SupplyPanel />}

          {/* Backhaul Tab */}
          {activeTab === 'backhaul' && (
            <div>
              <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <div className="text-blue-300 font-bold">Backhaul Optimization</div>
                    <p className="text-gray-400 text-sm mt-1">
                      Vehicles carrying less than 50% capacity are identified as backhaul candidates.
                      These can be loaded with return cargo to maximize efficiency.
                    </p>
                  </div>
                </div>
              </div>

              {backhaulCandidates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  ✅ All vehicles are efficiently loaded (≥50% capacity)
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {backhaulCandidates.map((v) => {
                    const emptyCapacity = 100 - v.current_load_pct;
                    return (
                      <div key={v.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 hover:border-orange-700 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-white font-bold">Vehicle #{v.id}</div>
                            <div className="text-gray-500 text-xs">{v.driver_name}</div>
                          </div>
                          <span className="bg-orange-900/60 text-orange-300 text-xs px-2 py-0.5 rounded border border-orange-700">
                            Backhaul Candidate
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-gray-400">
                            <span>Current Cargo:</span>
                            <span className="text-gray-300">{v.payload_type}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Destination:</span>
                            <span className="text-gray-300">{v.destination_name}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>ETA:</span>
                            <span className="text-gray-300">{formatEta(v.eta_hours)}</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Current Load</span>
                            <span className="text-orange-400 font-bold">{v.current_load_pct}%</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full"
                              style={{ width: `${v.current_load_pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 bg-green-900/20 border border-green-800 rounded-lg p-2.5 text-center">
                          <div className="text-green-300 text-xs font-bold">
                            🟢 {emptyCapacity}% Available for Backhaul
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
