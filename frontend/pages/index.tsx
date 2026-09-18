import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useVehicles, useSOSAlerts } from '../lib/firebaseRealtimeSync';

export default function Home() {
  const { t } = useTranslation();
  const vehicles = useVehicles();
  const sosAlerts = useSOSAlerts();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const onlineVehicles = vehicles.filter(v => v.status !== 'offline').length;

  return (
    <>
      <Head>
        <title>NER-SENTINEL — Emergency Logistics Intelligence</title>
        <meta name="description" content="Real-time emergency routing and logistics management for Northeast India" />
        <meta name="theme-color" content="#DC2626" />
      </Head>

      <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Satoshi, sans-serif' }}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="border-b border-neutral-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-xl shadow-sm">
                🛰️
              </div>
              <div>
                <div className="font-black text-neutral-900 text-base tracking-wide leading-none">NER-SENTINEL</div>
                <div className="text-xs text-neutral-400 leading-none mt-0.5">{t('tagline')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-700 font-semibold">{t('allSystemsOnline')}</span>
                <span className="text-neutral-300">|</span>
                <span className="font-mono text-neutral-500">{time}</span>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <main className="flex-1">
          {/* Big red accent strip + title */}
          <section className="relative overflow-hidden">
            {/* Background geometric accent */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-red-50 rounded-full opacity-80" />
              <div className="absolute top-1/2 -left-16 w-64 h-64 bg-red-50 rounded-full opacity-50" />
            </div>

            <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-12 text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-1.5 mb-6">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-700 text-sm font-semibold">Northeast India Emergency Response System</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-neutral-900 leading-none mb-3">
                NER-{' '}
                <span className="text-red-600">SENTINEL</span>
              </h1>
              <p className="text-neutral-500 text-lg max-w-xl mx-auto leading-relaxed mb-10">
                {t('landingSubtitle')}
              </p>

              {/* Live stats */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <StatCard icon="🚚" value={onlineVehicles || '5'} label={t('vehiclesOnline')} color="blue" />
                <StatCard icon="🚨" value={sosAlerts.length || '0'} label={t('activeAlerts')} color="red" />
                <StatCard icon="🌏" value="8" label="NE States Covered" color="green" />
              </div>

              {/* Portal Cards */}
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Command Center */}
                <Link
                  href="/command"
                  className="group relative bg-white border-2 border-neutral-200 hover:border-red-400 rounded-3xl p-7 text-left shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-3xl mb-5 shadow-lg group-hover:scale-105 transition-transform">
                    🌏
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 mb-3">
                    <div className="w-1 h-1 bg-red-500 rounded-full" />
                    <span className="text-red-600 text-xs font-bold">COMMAND</span>
                  </div>
                  <h2 className="text-xl font-black text-neutral-900 mb-2">{t('commandCenter')}</h2>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">{t('commandDesc')}</p>
                  <div className="flex flex-wrap gap-2">
                    {['Master Map', 'SOS Alerts', 'Supply Priority', 'Fleet Status'].map(f => (
                      <span key={f} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <div className="absolute bottom-7 right-7 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm group-hover:bg-red-700 transition-colors shadow-sm">
                    →
                  </div>
                </Link>

                {/* Driver Portal */}
                <Link
                  href="/driver"
                  className="group relative bg-white border-2 border-neutral-200 hover:border-red-400 rounded-3xl p-7 text-left shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-3xl mb-5 shadow-lg group-hover:scale-105 transition-transform">
                    🚚
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 rounded-full px-2.5 py-0.5 mb-3">
                    <div className="w-1 h-1 bg-neutral-600 rounded-full" />
                    <span className="text-neutral-700 text-xs font-bold">DRIVER</span>
                  </div>
                  <h2 className="text-xl font-black text-neutral-900 mb-2">{t('driverPortal')}</h2>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">{t('driverDesc')}</p>
                  <div className="flex flex-wrap gap-2">
                    {['Live Navigation', 'GPS Tracking', 'SOS Alert', 'AI Simulation'].map(f => (
                      <span key={f} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <div className="absolute bottom-7 right-7 w-8 h-8 bg-neutral-900 rounded-full flex items-center justify-center text-white text-sm group-hover:bg-neutral-700 transition-colors shadow-sm">
                    →
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* ── Features Strip ──────────────────────────────────────────── */}
          <section className="bg-neutral-50 border-t border-neutral-100 py-10">
            <div className="max-w-6xl mx-auto px-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[
                  { icon: '🔄', title: 'Real-Time Sync', desc: 'Firebase bi-directional sync across all portals' },
                  { icon: '🧠', title: 'AI Rerouting', desc: 'Automatic hazard-aware path optimization' },
                  { icon: '🌦️', title: 'Weather + Disasters', desc: 'Live overlays from Open-Meteo & USGS' },
                  { icon: '🌐', title: '4 Languages', desc: 'English, Hindi, Assamese & Bengali' },
                ].map(f => (
                  <div key={f.title} className="p-4">
                    <div className="text-3xl mb-2">{f.icon}</div>
                    <div className="font-bold text-neutral-900 text-sm mb-1">{f.title}</div>
                    <div className="text-xs text-neutral-500">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="border-t border-neutral-100 bg-white">
          <div className="max-w-6xl mx-auto px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-xs">🛰️</div>
              <span className="font-bold text-neutral-600">NER-SENTINEL</span>
              <span>— Northeast India Logistics Intelligence</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-700 font-medium">Live</span>
              </div>
              <span>Firebase Realtime · Open-Meteo Weather · USGS Disaster Data</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  const ring = color === 'red' ? 'border-red-200 bg-red-50' : color === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50';
  const text = color === 'red' ? 'text-red-700' : color === 'blue' ? 'text-blue-700' : 'text-green-700';
  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${ring}`}>
      <span className="text-2xl">{icon}</span>
      <div className="text-left">
        <div className={`text-xl font-black ${text}`}>{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
      </div>
    </div>
  );
}
