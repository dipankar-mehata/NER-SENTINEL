import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRoute, checkSegmentHazard, RouteSegment, haversine, MAX_REROUTES } from './AIRerouteEngine';
import { pushRerouteEvent, setActiveRoute, triggerSOS } from '../lib/firebaseRealtimeSync';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const SPEED_MULTIPLIERS = { '1x': 1, '2x': 2, '5x': 5 } as const;
type SpeedKey = keyof typeof SPEED_MULTIPLIERS;

function makeTruckIcon(moving: boolean) {
  return L.divIcon({
    html: `<div style="background:#DC2626;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:24px;border:3px solid white;box-shadow:0 4px 12px rgba(220,38,38,0.5);${moving ? 'animation:truck-bounce 0.8s ease-in-out infinite' : ''}">🚚</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
    className: '',
  });
}

const startIcon = L.divIcon({
  html: `<div style="background:#16A34A;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)">📍</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22], className: '',
});

const destIcon = L.divIcon({
  html: `<div style="background:#2563EB;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)">🏁</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22], className: '',
});

export interface SimulationMapProps {
  vehicleId: string;
  driverName: string;
  startLat: number;
  startLng: number;
  startLabel: string;
  endLat: number;
  endLng: number;
  endLabel: string;
}

export default function SimulationMap(props: SimulationMapProps) {
  const { vehicleId, driverName, startLat, startLng, startLabel, endLat, endLng, endLabel } = props;
  const { t } = useTranslation();

  const [route, setRoute]               = useState<RouteSegment[]>([]);
  const [truckPos, setTruckPos]         = useState<[number, number]>([startLat, startLng]);
  const [isRunning, setIsRunning]       = useState(false);
  const [speed, setSpeed]               = useState<SpeedKey>('1x');
  const [progress, setProgress]         = useState(0); // 0–100
  const [etaMin, setEtaMin]             = useState(0);
  const [totalEta, setTotalEta]         = useState(0);
  const [loading, setLoading]           = useState(false);
  const [toast, setToast]               = useState<{ type: 'reroute' | 'hazard' | 'sos'; msg: string } | null>(null);
  const [hazardZone, setHazardZone]     = useState<[number, number] | null>(null);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [lookAheadSeg, setLookAheadSeg] = useState<{lat: number, lng: number} | null>(null);
  const simRef = useRef<{ stop: boolean }>({ stop: false });

  const showToast = useCallback((type: typeof toast extends null ? never : NonNullable<typeof toast>['type'], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Load route on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const r = await fetchRoute(startLat, startLng, endLat, endLng);
      setRoute(r.segments);
      setTotalEta(r.estimatedTimeMin);
      setEtaMin(r.estimatedTimeMin);
      // Publish initial route to Firebase
      await setActiveRoute(vehicleId, r.segments.map(s => ({ lat: s.lat, lng: s.lng, risk: s.risk, color: s.color })), r.totalRiskScore, r.estimatedTimeMin);
      setLoading(false);
    };
    load();
  }, [startLat, startLng, endLat, endLng, vehicleId]);

  const stopSimulation = useCallback(() => {
    simRef.current.stop = true;
    setIsRunning(false);
  }, []);

  const startSimulation = useCallback(async () => {
    if (route.length === 0 || isRunning) return;
    simRef.current.stop = false;
    setIsRunning(true);
    setProgress(0);
    setTruckPos([startLat, startLng]);

    let currentRoute = [...route];
    const multiplier = SPEED_MULTIPLIERS[speed];
    const totalSteps = currentRoute.length;

    for (let i = 0; i < currentRoute.length; i++) {
      if (simRef.current.stop) break;

      const seg = currentRoute[i];
      const prev = i === 0 ? [startLat, startLng] as [number,number] : [currentRoute[i - 1].lat, currentRoute[i - 1].lng] as [number,number];

      // Calculate speed
      const dist = haversine(prev[0], prev[1], seg.lat, seg.lng);
      const fakeTimeH = (80 / multiplier * Math.max(8, Math.round(20 / multiplier))) / 3600000;
      setCurrentSpeed(Math.round(dist / (fakeTimeH || 0.01)));

      // Animate truck smoothly across this segment
      await animateSegment(prev, [seg.lat, seg.lng], multiplier, (pos) => {
        setTruckPos(pos);
      }, () => simRef.current.stop);

      if (simRef.current.stop) break;

      // Update progress
      const pct = Math.round(((i + 1) / totalSteps) * 100);
      setProgress(pct);
      const remaining = Math.round(totalEta * (1 - pct / 100));
      setEtaMin(remaining);

      // Check hazard on NEXT segment (look-ahead)
      if (i < currentRoute.length - 2) {
        const nextSeg = currentRoute[i + 1];
        setLookAheadSeg({ lat: nextSeg.lat, lng: nextSeg.lng });
        // Every 3rd segment, do a real hazard check
        if (i % 3 === 0) {
          const hazard = await checkSegmentHazard(nextSeg.lat, nextSeg.lng);
          if (!hazard.isSafe && rerouteCount < MAX_REROUTES) {
            setHazardZone([nextSeg.lat, nextSeg.lng]);
            showToast('hazard', `${t('hazardDetected')}: ${hazard.reason}`);

            // Trigger reroute
            const oldSummary = `Segment ${i + 1}/${totalSteps} via (${nextSeg.lat.toFixed(3)}, ${nextSeg.lng.toFixed(3)})`;
            const newRoute = await fetchRoute(seg.lat, seg.lng, endLat, endLng);

            // Push reroute event to Firebase
            await pushRerouteEvent(vehicleId, 'weather', oldSummary, newRoute.summary);
            await setActiveRoute(vehicleId,
              newRoute.segments.map(s => ({ lat: s.lat, lng: s.lng, risk: s.risk, color: s.color })),
              newRoute.totalRiskScore, newRoute.estimatedTimeMin, true
            );

            currentRoute = newRoute.segments;
            setRoute([...currentRoute]);
            setRerouteCount(c => c + 1);
            setTotalEta(newRoute.estimatedTimeMin);
            showToast('reroute', t('reroutedMsg'));

            // Reset loop to start of new route
            i = -1;
            setLookAheadSeg(null);
            continue;
          } else if (!hazard.isSafe && rerouteCount >= MAX_REROUTES) {
            showToast('hazard', `Max reroutes reached. Cannot avoid hazard: ${hazard.reason}`);
          }
        }
      } else {
        setLookAheadSeg(null);
      }
    }

    if (!simRef.current.stop) {
      setProgress(100);
      setEtaMin(0);
      setCurrentSpeed(0);
      setLookAheadSeg(null);
      setTruckPos([endLat, endLng]);
      showToast('sos', '✅ Delivery complete! Arrived at destination.');
    }
    setIsRunning(false);
  }, [route, isRunning, speed, startLat, startLng, endLat, endLng, vehicleId, totalEta, showToast, t]);

  // Build polyline from route
  const polylinePoints: [number, number][] = [
    [startLat, startLng],
    ...route.map(s => [s.lat, s.lng] as [number, number]),
  ];

  const center: [number, number] = [
    (startLat + endLat) / 2,
    (startLng + endLng) / 2,
  ];

  return (
    <div className="space-y-4">
      {/* Simulation Controls */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Start/Stop */}
          {!isRunning ? (
            <button
              onClick={startSimulation}
              disabled={loading || route.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><span className="animate-spin">⟳</span> {t('calculating')}</>
              ) : (
                <><span className="animate-truck">▶</span> {t('startSimulation')}</>
              )}
            </button>
          ) : (
            <button
              onClick={stopSimulation}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-700 hover:bg-neutral-800 text-white font-bold rounded-xl shadow-sm transition-all"
            >
              ⏹ {t('stopSimulation')}
            </button>
          )}

          {/* Speed selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">{t('simSpeed')}:</span>
            {(['1x', '2x', '5x'] as SpeedKey[]).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                disabled={isRunning}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  speed === s
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-red-300 disabled:opacity-60'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Reroute counter */}
          {rerouteCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl text-xs">
              <span className="text-orange-600 font-bold">{rerouteCount}×</span>
              <span className="text-orange-700">rerouted</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {(isRunning || progress > 0) && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{t('simProgress')}: {progress}%</span>
              <span>Speed: <span className="font-bold text-neutral-800">{currentSpeed} km/h</span></span>
              <span>{t('simEta')}: {etaMin > 0 ? `${etaMin} min` : 'Arrived!'}</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {t('simulationRunning')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] max-w-sm p-4 rounded-2xl shadow-lg border animate-slide-in ${
          toast.type === 'reroute' ? 'bg-white border-orange-300'
          : toast.type === 'hazard' ? 'bg-red-50 border-red-300'
          : 'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">
              {toast.type === 'reroute' ? '🔄' : toast.type === 'hazard' ? '⚠️' : '✅'}
            </span>
            <div>
              <div className={`font-bold text-sm ${
                toast.type === 'reroute' ? 'text-orange-800'
                : toast.type === 'hazard' ? 'text-red-800'
                : 'text-green-800'
              }`}>
                {toast.type === 'reroute' ? t('rerouted') : toast.type === 'hazard' ? t('hazardDetected') : 'Complete'}
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">{toast.msg}</div>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '500px', borderRadius: '12px' }}
        className="w-full shadow-md"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Route polyline — color-coded by risk */}
        {route.map((seg, i) => {
          if (i === 0) return null;
          const prev = i === 0 ? [startLat, startLng] : [route[i - 1].lat, route[i - 1].lng];
          return (
            <Polyline
              key={`seg-${i}-${seg.lat}-${seg.lng}`}
              positions={[prev as [number,number], [seg.lat, seg.lng]]}
              pathOptions={{ color: seg.color || '#16A34A', weight: 5, opacity: 0.85 }}
            />
          );
        })}

        {/* Full route ghost line */}
        {polylinePoints.length > 1 && (
          <Polyline
            positions={polylinePoints}
            pathOptions={{ color: '#DC2626', weight: 3, opacity: 0.2, dashArray: '8 8' }}
          />
        )}

        {/* Origin */}
        <Marker position={[startLat, startLng]} icon={startIcon}>
          <Popup><div className="font-semibold">📍 {startLabel}</div><div className="text-xs text-neutral-500">Origin</div></Popup>
        </Marker>

        {/* Destination */}
        <Marker position={[endLat, endLng]} icon={destIcon}>
          <Popup><div className="font-semibold">🏁 {endLabel}</div><div className="text-xs text-neutral-500">Destination</div></Popup>
        </Marker>

        {/* Animated truck */}
        <Marker position={truckPos} icon={makeTruckIcon(isRunning)}>
          <Popup>
            <div className="text-sm">
              <div className="font-bold">🚚 {driverName}</div>
              <div className="text-xs text-neutral-500 mt-1">Progress: {progress}%</div>
              <div className="text-xs text-neutral-500">ETA: {etaMin} min</div>
            </div>
          </Popup>
        </Marker>

        {/* Hazard zone */}
        {hazardZone && (
          <Circle
            center={hazardZone}
            radius={15000}
            pathOptions={{ fillColor: '#DC2626', fillOpacity: 0.25, color: '#DC2626', weight: 2, dashArray: '6 4' }}
          />
        )}

        {/* Look-ahead indicator */}
        {lookAheadSeg && (
          <Circle
            center={[lookAheadSeg.lat, lookAheadSeg.lng]}
            radius={3000}
            pathOptions={{ fillColor: '#3B82F6', fillOpacity: 0.4, color: '#2563EB', weight: 2 }}
            className="animate-ping"
          />
        )}
      </MapContainer>

      {/* Route info bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-neutral-600">Low Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-neutral-600">Moderate Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-neutral-600">High Risk</span>
        </div>
        <div className="ml-auto text-xs text-neutral-400">
          {route.length} segments · ETA ~{totalEta} min
        </div>
      </div>
    </div>
  );
}

// ── Animation helper ─────────────────────────────────────────────
async function animateSegment(
  from: [number, number],
  to: [number, number],
  speedMultiplier: number,
  onUpdate: (pos: [number, number]) => void,
  shouldStop: () => boolean
): Promise<void> {
  const FRAME_DURATION_MS = 80 / speedMultiplier; // ms per frame
  const TOTAL_FRAMES = Math.max(8, Math.round(20 / speedMultiplier));

  for (let f = 0; f <= TOTAL_FRAMES; f++) {
    if (shouldStop()) return;
    const t = f / TOTAL_FRAMES;
    const lat = from[0] + (to[0] - from[0]) * t;
    const lng = from[1] + (to[1] - from[1]) * t;
    onUpdate([lat, lng]);
    await sleep(FRAME_DURATION_MS);
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}
