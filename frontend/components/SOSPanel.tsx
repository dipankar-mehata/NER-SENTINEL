import { useTranslation } from 'react-i18next';
import { useSOSAlerts, resolveSOSAlert, SOSAlert } from '../lib/firebaseRealtimeSync';
import { useState } from 'react';

function formatTime(ts: { toDate?: () => Date } | null): string {
  if (!ts || !ts.toDate) return 'Just now';
  const d = ts.toDate();
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function SeverityBadge({ severity }: { severity: SOSAlert['severity'] }) {
  const colors = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${colors[severity]}`}>
      {severity}
    </span>
  );
}

export default function SOSPanel() {
  const { t } = useTranslation();
  const alerts = useSOSAlerts();
  const [resolving, setResolving] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    setResolving(id);
    await resolveSOSAlert(id);
    setResolving(null);
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
        <div className="text-5xl mb-3">✅</div>
        <p className="font-medium text-neutral-500">{t('noSosAlerts')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.filter(alert => typeof alert.lat === 'number' && typeof alert.lng === 'number').map(alert => (
        <div
          key={alert.id}
          className={`relative bg-white rounded-2xl border-2 shadow-md p-4 animate-slide-in ${
            alert.severity === 'CRITICAL' ? 'border-red-400 animate-sos-pulse' : 'border-orange-300'
          }`}
        >
          {/* Pulsing dot */}
          <div className="absolute top-4 right-4">
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping-red" />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl shrink-0">
              🚨
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-neutral-900 text-sm">{alert.driverName}</span>
                <SeverityBadge severity={alert.severity} />
              </div>
              <p className="text-sm text-neutral-600 mb-2">{alert.message}</p>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span>📍 {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}</span>
                <span>🕐 {formatTime(alert.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <a
              href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center text-xs font-medium py-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              📍 View on Map
            </a>
            <button
              onClick={() => handleResolve(alert.id)}
              disabled={resolving === alert.id}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
            >
              {resolving === alert.id ? '…' : `✓ ${t('resolve')}`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
