import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import '../../lib/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import SOSPanel from '../../components/SOSPanel';
import SupplyPriorityManager from '../../components/SupplyPriorityManager';
import { useVehicles, useSOSAlerts } from '../../lib/firebaseRealtimeSync';

const CommandMap = dynamic(() => import('../../components/CommandMap'), { ssr: false });

type Tab = 'map' | 'sos' | 'supply' | 'fleet';

export default function CommandCenter() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const vehicles = useVehicles();
  const sosAlerts = useSOSAlerts();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const onlineCount = vehicles.filter(v => v.status !== 'offline').length;
  const criticalCount = vehicles.filter(v => v.priority === 'HIGH').length;

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'map',    label: t('masterMap'),     icon: '🗺️' },
    { id: 'sos',    label: t('sosAlerts'),     icon: '🚨', badge: sosAlerts.length },
    { id: 'supply', label: t('supplyPriority'),icon: '📦' },
    { id: 'fleet',  label: t('fleetStatus'),   icon: '🚚' },
  ];

  return (
    <>
      <Head>
        <title>{t('commandTitle')} — NER-SENTINEL</title>
        <meta name="description" content="Logistics Command Center for NER-SENTINEL" />
      </Head>

      <div className="min-h-screen bg-neutral-50 flex flex-col" style={{ fontFamily: 'Satoshi, sans-serif' }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center text-lg shadow-sm group-hover:bg-red-700 transition-colors">
                  🛰️
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-black text-neutral-900 tracking-wide leading-none">NER-SENTINEL</div>
                  <div className="text-xs text-neutral-400 leading-none mt-0.5">{t('commandTitle')}</div>
                </div>
              </Link>
            </div>

            {/* Stat Pills */}
            <div className="hidden md:flex items-center gap-3">
              <StatPill icon="🚚" value={onlineCount} label={t('vehiclesOnline')} color="blue" />
              <StatPill icon="🚨" value={sosAlerts.length} label={t('activeAlerts')} color="red" pulse={sosAlerts.length > 0} />
              <StatPill icon="📦" value={criticalCount} label={t('criticalSupplies')} color="orange" />
            </div>

            {/* Right — time + live + lang */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-700 font-semibold">{t('live')}</span>
                <span className="text-neutral-400 ml-2 font-mono">{time}</span>
              </div>
              <LanguageSwitcher compact />
            </div>
          </div>

          {/* Mobile stat row */}
          <div className="md:hidden px-4 pb-2 flex gap-2 overflow-x-auto text-xs">
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full whitespace-nowrap font-medium">
              🚚 {onlineCount} {t('vehiclesOnline')}
            </span>
            {sosAlerts.length > 0 && (
              <span className="bg-red-50 text-red-700 border border-red-300 px-2 py-1 rounded-full whitespace-nowrap font-semibold animate-pulse">
                🚨 {sosAlerts.length} {t('activeAlerts')}
              </span>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex border-t border-neutral-100 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-700 bg-red-50'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute -top-0.5 right-2 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* ── Main Content ───────────────────────────────────────── */}
        <main className="flex-1 p-4 md:p-6">
          {activeTab === 'map' && (
            <div className="animate-fade-up">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">{t('masterMap')}</h2>
                  <p className="text-sm text-neutral-500">Real-time vehicle tracking, weather, and disaster overlays</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Firebase Synced
                </div>
              </div>
              <CommandMap vehicles={vehicles} sosAlerts={sosAlerts} />
            </div>
          )}

          {activeTab === 'sos' && (
            <div className="max-w-2xl mx-auto animate-fade-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-neutral-900">{t('sosAlerts')}</h2>
                <p className="text-sm text-neutral-500">Active emergency alerts — updates in real-time via Firebase</p>
              </div>
              <SOSPanel />
            </div>
          )}

          {activeTab === 'supply' && (
            <div className="animate-fade-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-neutral-900">{t('supplyPriority')}</h2>
                <p className="text-sm text-neutral-500">
                  🔴 Red = Highest &nbsp;•&nbsp; 🟡 Yellow = Moderate &nbsp;•&nbsp; 🟢 Green = Lowest
                </p>
              </div>
              <SupplyPriorityManager />
            </div>
          )}

          {activeTab === 'fleet' && (
            <div className="animate-fade-up">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-neutral-900">{t('fleetStatus')}</h2>
                <p className="text-sm text-neutral-500">Live fleet overview — positions and status from Firebase</p>
              </div>
              <FleetTable vehicles={vehicles} />
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function StatPill({ icon, value, label, color, pulse }: {
  icon: string; value: number; label: string;
  color: 'blue' | 'red' | 'orange'; pulse?: boolean;
}) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    red:    'bg-red-50 border-red-300 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${colors[color]} ${pulse ? 'animate-pulse' : ''}`}>
      <span>{icon}</span>
      <span className="font-bold text-base">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

import { FirebaseVehicle } from '../../lib/firebaseRealtimeSync';

const PRIORITY_STYLE: Record<string, { dot: string; text: string }> = {
  HIGH:     { dot: 'bg-red-500',    text: 'text-red-700' },
  MODERATE: { dot: 'bg-yellow-500', text: 'text-yellow-700' },
  LOW:      { dot: 'bg-green-500',  text: 'text-green-700' },
};

const STATUS_EMOJI: Record<string, string> = {
  'online':   '🟢',
  'en-route': '🔵',
  'stopped':  '🟡',
  'offline':  '⚫',
};

function FleetTable({ vehicles }: { vehicles: FirebaseVehicle[] }) {
  const { t } = useTranslation();

  // Demo data if Firebase not connected
  const displayVehicles: FirebaseVehicle[] = vehicles.length > 0 ? vehicles : [
    { id: 'V001', driverName: 'Rajesh Kumar', status: 'en-route', lat: 26.14, lng: 91.74, speed: 52, heading: 90, destinationName: 'Tezpur Relief Camp', destinationLat: 26.63, destinationLng: 92.80, payloadType: 'Medical Supplies', priority: 'HIGH', currentLoadPct: 87, updatedAt: null },
    { id: 'V002', driverName: 'Priya Das', status: 'en-route', lat: 26.35, lng: 92.68, speed: 38, heading: 45, destinationName: 'Jorhat Distribution Hub', destinationLat: 26.75, destinationLng: 94.20, payloadType: 'Food Packets', priority: 'MODERATE', currentLoadPct: 95, updatedAt: null },
    { id: 'V003', driverName: 'Mohan Singh', status: 'stopped', lat: 27.47, lng: 94.91, speed: 0, heading: 0, destinationName: 'Dibrugarh Flood Zone', destinationLat: 27.5, destinationLng: 95.0, payloadType: 'Water & Sanitation', priority: 'HIGH', currentLoadPct: 100, updatedAt: null },
    { id: 'V004', driverName: 'Anita Sharma', status: 'online', lat: 25.58, lng: 91.89, speed: 0, heading: 0, destinationName: 'Shillong Hospital', destinationLat: 25.57, destinationLng: 91.88, payloadType: 'Medicines', priority: 'HIGH', currentLoadPct: 70, updatedAt: null },
    { id: 'V005', driverName: 'Bikash Nath', status: 'en-route', lat: 24.83, lng: 92.78, speed: 45, heading: 180, destinationName: 'Silchar Shelter', destinationLat: 24.80, destinationLng: 92.75, payloadType: 'Tarpaulin & Blankets', priority: 'LOW', currentLoadPct: 60, updatedAt: null },
  ];

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-100">
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3">Driver</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden sm:table-cell">Status</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden md:table-cell">Payload</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3">Destination</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3">{t('priority')}</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden lg:table-cell">Load</th>
            <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden lg:table-cell">Speed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {displayVehicles.map(v => {
            const ps = PRIORITY_STYLE[v.priority] || PRIORITY_STYLE['LOW'];
            return (
              <tr key={v.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-bold text-red-700">
                      {v.driverName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{v.driverName}</div>
                      <div className="text-xs text-neutral-400">{v.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm">{STATUS_EMOJI[v.status] || '⚫'} <span className="capitalize text-neutral-600 text-xs">{v.status}</span></span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-neutral-500">{v.payloadType}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-neutral-700">{v.destinationName}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ps.dot}`} />
                    <span className={`text-xs font-semibold ${ps.text}`}>{v.priority}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="w-20">
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          v.currentLoadPct > 90 ? 'bg-red-500' : v.currentLoadPct > 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${v.currentLoadPct}%` }}
                      />
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">{v.currentLoadPct}%</div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs font-mono text-neutral-600">{v.speed} km/h</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {displayVehicles.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <div className="text-4xl mb-2">🚚</div>
          <p>No vehicles online</p>
        </div>
      )}
    </div>
  );
}
