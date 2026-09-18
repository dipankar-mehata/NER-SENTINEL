'use client';
import { useEffect, useRef, useState } from 'react';

type Coordinate = [number, number];

interface MapplsDriverMapProps {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startLabel: string;
  endLabel: string;
  routeAPositions: Coordinate[];
  routeBPositions: Coordinate[];
  routeARisk?: number;
  routeBRisk?: number;
  onFallback?: () => void;
}

export default function MapplsDriverMap({
  startLat,
  startLng,
  endLat,
  endLng,
  startLabel,
  endLabel,
  routeAPositions,
  routeBPositions,
  routeARisk,
  routeBRisk,
  onFallback,
}: MapplsDriverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: any;
    let tries = 0;
    const check = () => {
      if (typeof window !== 'undefined' && (window as any).mappls && (window as any).mappls.Map) {
        setReady(true);
      } else if (tries < 25) {
        tries++;
        timer = setTimeout(check, 400);
      } else {
        if (onFallback) onFallback();
      }
    };
    check();
    return () => { if (timer) clearTimeout(timer); };
  }, [onFallback]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    try {
      const mappls = (window as any).mappls;
      const center = [(startLat + endLat) / 2, (startLng + endLng) / 2];
      const map = new mappls.Map(containerRef.current, {
        center,
        zoom: 8,
        zoomControl: true,
      });
      mapRef.current = map;
    } catch (e) {
      console.warn('Mappls driver map init failed:', e);
      if (onFallback) onFallback();
    }
  }, [ready, startLat, startLng, endLat, endLng, onFallback]);

  useEffect(() => {
    const map = mapRef.current;
    const mappls = typeof window !== 'undefined' && (window as any).mappls;
    if (!map || !mappls) return;

    // Clear previous
    overlaysRef.current.forEach((o) => {
      try { if (o && typeof o.remove === 'function') o.remove(); } catch {}
    });
    overlaysRef.current = [];

    try {
      // 1. Start Marker
      const startMarker = new mappls.Marker({
        map,
        position: { lat: startLat, lng: startLng },
        title: `🚚 Start: ${startLabel}`,
      });
      overlaysRef.current.push(startMarker);

      // 2. End Marker
      const endMarker = new mappls.Marker({
        map,
        position: { lat: endLat, lng: endLng },
        title: `🏁 Destination: ${endLabel}`,
      });
      overlaysRef.current.push(endMarker);

      // 3. Route A (Shortest - Red/Orange)
      if (routeAPositions.length >= 2) {
        const polyA = new mappls.Polyline({
          map,
          path: routeAPositions.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: '#ef4444',
          strokeWeight: 6,
          strokeOpacity: 0.85,
        });
        overlaysRef.current.push(polyA);
      }

      // 4. Route B (Safest - Green)
      if (routeBPositions.length >= 2) {
        const polyB = new mappls.Polyline({
          map,
          path: routeBPositions.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: '#22c55e',
          strokeWeight: 6,
          strokeOpacity: 0.9,
        });
        overlaysRef.current.push(polyB);
      }
    } catch (err) {
      console.warn('Mappls driver overlays error:', err);
    }
  }, [ready, startLat, startLng, endLat, endLng, startLabel, endLabel, routeAPositions, routeBPositions]);

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-400 gap-2">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Loading Mappls Navigation Map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '380px' }} />
      <div className="absolute bottom-2 left-2 z-[10] bg-gray-900/90 backdrop-blur border border-gray-700 px-3 py-1 rounded-md text-[11px] text-gray-300 flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span>Powered by <b>Mappls</b> (Key: idcbzgnknzuqlwhektvbhzgiksexnptuzhpj)</span>
      </div>
    </div>
  );
}
