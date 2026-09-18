import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import DisasterSim from '../../components/DisasterSim';
import WhatIfSimulator from '../../components/WhatIfSimulator';
import RiskForecast from '../../components/RiskForecast';

const LiveMap = dynamic(() => import('../../components/LiveMap'), { ssr: false });

type Tab = 'map' | 'sim' | 'whatif' | 'forecast';

interface Stats {
  vehicles: number;
  incidents: number;
  districtsAtRisk: number;
  highRiskSegments: number;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'Live Map', icon: '🗺️' },
  { id: 'sim', label: 'Disaster Sim', icon: '🎮' },
  { id: 'whatif', label: 'What-If', icon: '⚡' },
  { id: 'forecast', label: '24h Forecast', icon: '🔮' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [stats, setStats] = useState<Stats>({ vehicles: 0, incidents: 0, districtsAtRisk: 0, highRiskSegments: 0 });

  const fetchStats = async () => {
    try {
      const [vRes, iRes, dRes, sRes] = await Promise.allSettled([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/districts`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/road-segments`),
      ]);

      let vehicles = 0, incidents = 0, districtsAtRisk = 0, highRiskSegments = 0;

      if (vRes.status === 'fulfilled' && vRes.value.ok) {
        const d = await vRes.value.json();
        vehicles = Array.isArray(d) ? d.length : 0;
      }
      if (iRes.status === 'fulfilled' && iRes.value.ok) {
        const d = await iRes.value.json();
        incidents = Array.isArray(d) ? d.length : 0;
      }
      if (dRes.status === 'fulfilled' && dRes.value.ok) {
        const d = await dRes.value.json();
        districtsAtRisk = Array.isArray(d) ? d.filter((dist: { accessibility_score: number }) => dist.accessibility_score < 60).length : 0;
      }
      if (sRes.status === 'fulfilled' && sRes.value.ok) {
        const d = await sRes.value.json();
        highRiskSegments = Array.isArray(d) ? d.filter((seg: { risk_label: string }) => seg.risk_label === 'HIGH').length : 0;
      }

      setStats({ vehicles, incidents, districtsAtRisk, highRiskSegments });
    } catch {
      // Silently continue
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Head>
        <title>Admin Command Center — NER-SENTINEL</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <div className="px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Home</Link>
              <div className="w-px h-4 bg-gray-700" />
              <div className="flex items-center gap-2">
                <span className="text-lg">🛰️</span>
                <span className="font-black text-white tracking-wider text-sm">ADMIN COMMAND CENTER</span>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-800 px-3 py-1.5 rounded-lg">
                <span>🚚</span>
                <span className="text-blue-300 font-bold">{stats.vehicles}</span>
                <span className="text-gray-500">Vehicles</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-900/40 border border-orange-800 px-3 py-1.5 rounded-lg">
                <span>⚠️</span>
                <span className="text-orange-300 font-bold">{stats.incidents}</span>
                <span className="text-gray-500">Incidents</span>
              </div>
              <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 px-3 py-1.5 rounded-lg">
                <span>🗺️</span>
                <span className="text-red-300 font-bold">{stats.districtsAtRisk}</span>
                <span className="text-gray-500">At Risk</span>
              </div>
              <div className="flex items-center gap-1.5 bg-yellow-900/40 border border-yellow-800 px-3 py-1.5 rounded-lg">
                <span>🛣️</span>
                <span className="text-yellow-300 font-bold">{stats.highRiskSegments}</span>
                <span className="text-gray-500">High Risk</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs">Live</span>
            </div>
          </div>

          {/* Mobile stats */}
          <div className="md:hidden px-4 pb-2 flex gap-2 overflow-x-auto text-xs">
            <span className="text-blue-300 bg-blue-900/40 px-2 py-1 rounded whitespace-nowrap">🚚 {stats.vehicles} Vehicles</span>
            <span className="text-orange-300 bg-orange-900/40 px-2 py-1 rounded whitespace-nowrap">⚠️ {stats.incidents} Incidents</span>
            <span className="text-red-300 bg-red-900/40 px-2 py-1 rounded whitespace-nowrap">🗺️ {stats.districtsAtRisk} At Risk</span>
            <span className="text-yellow-300 bg-yellow-900/40 px-2 py-1 rounded whitespace-nowrap">🛣️ {stats.highRiskSegments} High Risk</span>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-t border-gray-800 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4">
          {activeTab === 'map' && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-gray-300 font-semibold text-sm">Live Logistics Map</h2>
                <span className="text-xs text-gray-600">Auto-refreshes every 15s</span>
              </div>
              <LiveMap />
            </div>
          )}

          {activeTab === 'sim' && (
            <DisasterSim />
          )}

          {activeTab === 'whatif' && (
            <WhatIfSimulator />
          )}

          {activeTab === 'forecast' && (
            <RiskForecast />
          )}
        </main>
      </div>
    </>
  );
}
