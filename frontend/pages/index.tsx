import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

interface StatsData {
  vehicleCount: number;
  incidentCount: number;
}

const ROLES = [
  {
    emoji: '🏛️',
    title: 'Admin Command Center',
    description: 'Full situational awareness, disaster simulation, AI copilot, and risk forecasting.',
    href: '/admin',
    color: 'from-blue-600 to-blue-800',
    border: 'border-blue-700 hover:border-blue-400',
    badge: 'COMMAND',
    badgeColor: 'bg-blue-900 text-blue-300',
  },
  {
    emoji: '🗺️',
    title: 'District Officer',
    description: 'Monitor district accessibility scores, incidents, road conditions, and weather alerts.',
    href: '/district',
    color: 'from-purple-600 to-purple-800',
    border: 'border-purple-700 hover:border-purple-400',
    badge: 'DISTRICT',
    badgeColor: 'bg-purple-900 text-purple-300',
  },
  {
    emoji: '📦',
    title: 'Logistics Manager',
    description: 'Fleet management, supply chain status, backhaul optimization, and cargo tracking.',
    href: '/logistics',
    color: 'from-orange-600 to-orange-800',
    border: 'border-orange-700 hover:border-orange-400',
    badge: 'LOGISTICS',
    badgeColor: 'bg-orange-900 text-orange-300',
  },
  {
    emoji: '🚚',
    title: 'Driver Portal',
    description: 'Live route navigation, hazard alerts, route comparison, and GPS location sharing.',
    href: '/driver',
    color: 'from-teal-600 to-teal-800',
    border: 'border-teal-700 hover:border-teal-400',
    badge: 'DRIVER',
    badgeColor: 'bg-teal-900 text-teal-300',
  },
];

export default function Home() {
  const [stats, setStats] = useState<StatsData>({ vehicleCount: 0, incidentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [vRes, iRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/vehicles`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`),
        ]);
        const [vehicles, incidents] = await Promise.all([vRes.json(), iRes.json()]);
        setStats({
          vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
          incidentCount: Array.isArray(incidents) ? incidents.length : 0,
        });
      } catch {
        // Silently fail — stats are informational only
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <>
      <Head>
        <title>NER-SENTINEL — Northeast India Logistics Intelligence</title>
        <meta name="description" content="NER-SENTINEL Logistics Intelligence Platform for Northeast India" />
        <meta name="theme-color" content="#111827" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Animated background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-900/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-900/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-green-900/10 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="relative z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl font-black">
                🛰️
              </div>
              <div>
                <span className="text-lg font-black tracking-wider text-white">NER-SENTINEL</span>
                <div className="text-xs text-gray-500 leading-none">v2.0 Intelligence Platform</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">All Systems Online</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700 rounded-full px-4 py-1.5 mb-6 text-blue-300 text-sm font-medium">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Northeast India Logistics Intelligence Platform
            </div>

            <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                NER-SENTINEL
              </span>
            </h1>

            <p className="text-gray-400 text-xl max-w-2xl mx-auto leading-relaxed">
              Real-time logistics intelligence, disaster simulation, and AI-powered route optimization
              for the Northeast India corridor.
            </p>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
            {ROLES.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className={`group relative bg-gray-900 border ${role.border} rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 cursor-pointer`}
              >
                {/* Badge */}
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${role.badgeColor}`}>
                    {role.badge}
                  </span>
                  <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-sm">→</span>
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${role.color} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>
                  {role.emoji}
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight mb-2">{role.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{role.description}</p>
                </div>

                {/* Enter button */}
                <div className={`mt-auto w-full bg-gradient-to-r ${role.color} opacity-0 group-hover:opacity-100 transition-all text-white text-center py-2 rounded-xl text-sm font-bold`}>
                  Enter Portal →
                </div>
              </Link>
            ))}
          </div>
        </main>

        {/* Status Bar */}
        <footer className="relative z-10 border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 font-medium">System Online</span>
              </div>
              <div className="text-gray-400">
                <span className="text-white font-bold">{loading ? '...' : stats.vehicleCount}</span> Active Vehicles
              </div>
              <div className="text-gray-400">
                <span className={`font-bold ${stats.incidentCount > 0 ? 'text-orange-400' : 'text-white'}`}>
                  {loading ? '...' : stats.incidentCount}
                </span> Active Incidents
              </div>
            </div>
            <div className="text-gray-600 text-xs">
              Backend: http://localhost:8000 • Data refreshes every 15s
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
