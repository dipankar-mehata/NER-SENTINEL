'use client';
import { useEffect, useRef, useState } from 'react';

type Coordinate = [number, number];

export interface FuelStation {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  fuels: string[];
  is_24x7: boolean;
  def_available: boolean;
  contact: string;
  distance_km?: number;
}

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
  isRouteBRecommended?: boolean;
  showFuelPumps?: boolean;
  fuelStations?: FuelStation[];
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
  routeARisk = 35,
  routeBRisk = 25,
  isRouteBRecommended = false,
  showFuelPumps = false,
  fuelStations = [],
  onFallback,
}: MapplsDriverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // 1. Ensure Mappls Web SDK script is loaded
  useEffect(() => {
    let timer: any;

    const checkSdk = () => {
      if (typeof window !== 'undefined' && (window as any).mappls && (window as any).mappls.Map) {
        setSdkReady(true);
      } else {
        // Dynamically load script if not present
        const existingScript = document.getElementById('mappls-sdk-script');
        if (!existingScript && typeof document !== 'undefined') {
          const key = process.env.NEXT_PUBLIC_MAPPLS_KEY || '';
          if (!key) {
            setInitError('Mappls API key not configured.');
            if (onFallback) onFallback();
            return;
          }
          const script = document.createElement('script');
          script.id = 'mappls-sdk-script';
          script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${key}`;
          script.async = true;
          script.onload = () => {
            setTimeout(() => setSdkReady(true), 300);
          };
          script.onerror = () => {
            setInitError('Failed to load Mappls Maps SDK.');
            if (onFallback) onFallback();
          };
          document.head.appendChild(script);
        } else {
          timer = setTimeout(checkSdk, 400);
        }
      }
    };

    checkSdk();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onFallback]);

  // 2. Initialize the map once SDK is ready and DOM element exists
  useEffect(() => {
    const container = containerRef.current || (typeof document !== 'undefined' ? document.getElementById('mappls-driver-map') : null);
    if (!sdkReady || mapRef.current || !container) return;

    try {
      const mappls = (window as any).mappls;
      const validStartLat = !isNaN(startLat) ? startLat : 26.14;
      const validStartLng = !isNaN(startLng) ? startLng : 91.73;
      const validEndLat = !isNaN(endLat) ? endLat : 26.65;
      const validEndLng = !isNaN(endLng) ? endLng : 92.79;
      const center = [(validStartLat + validEndLat) / 2, (validStartLng + validEndLng) / 2];

      const map = new mappls.Map(container, {
        center: center,
        zoom: 8,
        zoomControl: true,
      });

      const onReady = () => setMapLoaded(true);
      if (typeof map.addListener === 'function') {
        map.addListener('load', onReady);
      }
      if (typeof map.on === 'function') {
        map.on('load', onReady);
      }

      // Check if map container canvas is ready
      const interval = setInterval(() => {
        if (map && (typeof map.getCanvasContainer === 'function' || map._loaded)) {
          setMapLoaded(true);
          clearInterval(interval);
        }
      }, 300);

      setTimeout(() => clearInterval(interval), 4000);

      mapRef.current = map;
    } catch (err: any) {
      console.warn('Mappls driver map instantiation error:', err);
      setInitError('Mappls map initialization error.');
    }
  }, [sdkReady, startLat, startLng, endLat, endLng]);

  // 3. Draw routes and markers once map is loaded
  useEffect(() => {
    const map = mapRef.current;
    const mappls = typeof window !== 'undefined' && (window as any).mappls;
    if (!map || !mappls || !mapLoaded) return;
    if (typeof map.getCanvasContainer !== 'function' && !map._loaded) return;

    // Clear previous overlays
    overlaysRef.current.forEach((item) => {
      try {
        if (item && typeof item.remove === 'function') {
          item.remove();
        }
      } catch {}
    });
    overlaysRef.current = [];

    try {
      const validStartLat = !isNaN(startLat) ? startLat : 26.14;
      const validStartLng = !isNaN(startLng) ? startLng : 91.73;
      const validEndLat = !isNaN(endLat) ? endLat : 26.65;
      const validEndLng = !isNaN(endLng) ? endLng : 92.79;

      // Start Marker
      const startMarker = new mappls.Marker({
        map: map,
        position: { lat: validStartLat, lng: validStartLng },
        title: `Start: ${startLabel}`,
      });
      overlaysRef.current.push(startMarker);

      // Destination Marker
      const endMarker = new mappls.Marker({
        map: map,
        position: { lat: validEndLat, lng: validEndLng },
        title: `Destination: ${endLabel}`,
      });
      overlaysRef.current.push(endMarker);

      // Sanitize coordinates
      const cleanA = routeAPositions
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
        .map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }));

      const cleanB = routeBPositions
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
        .map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }));

      // Route A Polyline
      if (cleanA.length >= 2) {
        const polyA = new mappls.Polyline({
          map: map,
          path: cleanA,
          strokeColor: !isRouteBRecommended ? '#22c55e' : '#ef4444',
          strokeWeight: !isRouteBRecommended ? 6 : 4,
          strokeOpacity: !isRouteBRecommended ? 0.95 : 0.75,
        });

        const infoA = `
          <div style="font-family:system-ui,sans-serif;padding:6px;min-width:160px;color:#111;">
            <div style="font-weight:bold;font-size:13px;color:${!isRouteBRecommended ? '#15803d' : '#b91c1c'};">
              Route A (Direct / Shortest) ${!isRouteBRecommended ? '✓ Recommended' : ''}
            </div>
            <div style="font-size:11px;margin-top:2px;">Risk Score: ${routeARisk}/100</div>
          </div>
        `;
        if (typeof polyA.addListener === 'function') {
          polyA.addListener('click', () => {
            new mappls.InfoWindow({
              map: map,
              content: infoA,
              position: cleanA[Math.floor(cleanA.length / 2)],
            });
          });
        }
        overlaysRef.current.push(polyA);
      }

      // Route B Polyline
      if (cleanB.length >= 2) {
        const polyB = new mappls.Polyline({
          map: map,
          path: cleanB,
          strokeColor: isRouteBRecommended ? '#22c55e' : '#3b82f6',
          strokeWeight: isRouteBRecommended ? 6 : 4,
          strokeOpacity: isRouteBRecommended ? 0.95 : 0.75,
        });

        const infoB = `
          <div style="font-family:system-ui,sans-serif;padding:6px;min-width:160px;color:#111;">
            <div style="font-weight:bold;font-size:13px;color:${isRouteBRecommended ? '#15803d' : '#1d4ed8'};">
              Route B (Alternative) ${isRouteBRecommended ? '✓ Recommended' : ''}
            </div>
            <div style="font-size:11px;margin-top:2px;">Risk Score: ${routeBRisk}/100</div>
          </div>
        `;
        if (typeof polyB.addListener === 'function') {
          polyB.addListener('click', () => {
            new mappls.InfoWindow({
              map: map,
              content: infoB,
              position: cleanB[Math.floor(cleanB.length / 2)],
            });
          });
        }
        overlaysRef.current.push(polyB);
      }

      // Fuel Stations Layer
      if (showFuelPumps && Array.isArray(fuelStations)) {
        fuelStations.forEach((fs) => {
          if (isNaN(fs.lat) || isNaN(fs.lng)) return;
          try {
            const fuelMarker = new mappls.Marker({
              map: map,
              position: { lat: fs.lat, lng: fs.lng },
              title: `⛽ ${fs.name} (${fs.brand})`,
            });
            const fuelInfo = `
              <div style="font-family:system-ui,sans-serif;padding:6px;min-width:180px;color:#111;">
                <div style="font-weight:bold;font-size:13px;color:#c2410c;">⛽ ${fs.name}</div>
                <div style="font-size:11px;color:#555;margin-top:2px;">${fs.brand} • ${fs.is_24x7 ? '24x7 Open' : 'Day Hours'}</div>
                <div style="font-size:10px;margin-top:4px;color:#333;">
                  <b>Fuels:</b> ${fs.fuels.join(', ')} ${fs.def_available ? ' | DEF / AdBlue Available' : ''}
                </div>
                ${fs.distance_km !== undefined ? `<div style="font-size:10px;color:#0284c7;margin-top:2px;font-weight:bold;">${fs.distance_km} km away</div>` : ''}
                ${fs.contact ? `<div style="font-size:10px;color:#666;margin-top:2px;">📞 ${fs.contact}</div>` : ''}
              </div>
            `;
            if (typeof fuelMarker.addListener === 'function') {
              fuelMarker.addListener('click', () => {
                new mappls.InfoWindow({
                  map: map,
                  content: fuelInfo,
                  position: { lat: fs.lat, lng: fs.lng },
                });
              });
            }
            overlaysRef.current.push(fuelMarker);
          } catch (err) {
            console.warn('Error adding Mappls fuel marker:', err);
          }
        });
      }
    } catch (e) {
      console.warn('Error adding driver overlays:', e);
    }
  }, [
    mapLoaded,
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
    isRouteBRecommended,
    showFuelPumps,
    fuelStations,
  ]);

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-300 p-6 text-center">
        <div className="text-3xl mb-2">🗺️</div>
        <p className="font-semibold text-sm">Mappls Driver Map Notice</p>
        <p className="text-xs text-gray-400 mt-1">{initError}</p>
        {onFallback && (
          <button
            onClick={onFallback}
            className="mt-3 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-all"
          >
            Switch to OpenStreetMap
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: '380px' }}>
      {!mapLoaded && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center bg-gray-900/90 text-gray-400 gap-2">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Initializing Mappls Navigation Map...</p>
        </div>
      )}
      <div
        ref={containerRef}
        id="mappls-driver-map"
        style={{ width: '100%', height: '100%', minHeight: '380px' }}
      />
      <div className="absolute bottom-2 left-2 z-[10] bg-gray-900/90 backdrop-blur border border-gray-700 px-3 py-1 rounded-md text-[11px] text-gray-300 flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span>Powered by <b>Mappls</b> (MapmyIndia)</span>
      </div>
    </div>
  );
}
