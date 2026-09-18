import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

if (typeof window !== 'undefined') {
  // Fix Leaflet default marker icon paths in Next.js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const startIcon = L.divIcon({
  html: `<div style="background:#22c55e;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  className: '',
});

const endIcon = L.divIcon({
  html: `<div style="background:#3b82f6;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏁</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  className: '',
});

type Coordinate = [number, number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Segment {
  start: any;
  end: any;
  color?: string;
  risk?: number;
  dist_km?: number;
}

interface RouteData {
  segments: Segment[];
  total_risk: number;
  time_min: number;
  label?: string;
}

interface DriverRouteMapProps {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  routeA: RouteData | null;
  routeB: RouteData | null;
  startLabel: string;
  endLabel: string;
  isRouteBRecommended?: boolean;
}

function parsePoint(pt: unknown): Coordinate | null {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  if (typeof pt === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = pt as any;
    const lat = Number(obj.lat ?? obj.latitude);
    const lng = Number(obj.lng ?? obj.lon ?? obj.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  return null;
}

function buildPolylinePositions(route: RouteData | null): Coordinate[] {
  if (!route || !Array.isArray(route.segments) || route.segments.length === 0) return [];
  const positions: Coordinate[] = [];

  for (const seg of route.segments) {
    const s = parsePoint(seg.start);
    const e = parsePoint(seg.end);

    if (s) {
      const last = positions[positions.length - 1];
      if (!last || last[0] !== s[0] || last[1] !== s[1]) {
        positions.push(s);
      }
    }
    if (e) {
      const last = positions[positions.length - 1];
      if (!last || last[0] !== e[0] || last[1] !== e[1]) {
        positions.push(e);
      }
    }
  }

  return positions;
}

function MapBoundsUpdater({ bounds }: { bounds: Coordinate[] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length >= 2) {
      try {
        const leafletBounds = L.latLngBounds(bounds.map(([lat, lng]) => L.latLng(lat, lng)));
        map.fitBounds(leafletBounds, { padding: [40, 40], maxZoom: 12 });
      } catch {
        // Ignore zoom errors if coordinates are degenerate
      }
    }
  }, [map, bounds]);
  return null;
}

import { useState } from 'react';
import MapplsDriverMap from './MapplsDriverMap';

export default function DriverRouteMap({
  startLat,
  startLng,
  endLat,
  endLng,
  routeA,
  routeB,
  startLabel,
  endLabel,
  isRouteBRecommended = false,
}: DriverRouteMapProps) {
  if (typeof window === 'undefined') return null;

  const [mapProvider, setMapProvider] = useState<'mappls' | 'osm'>('mappls');

  const validStartLat = !isNaN(startLat) ? startLat : 26.14;
  const validStartLng = !isNaN(startLng) ? startLng : 91.73;
  const validEndLat = !isNaN(endLat) ? endLat : 26.65;
  const validEndLng = !isNaN(endLng) ? endLng : 92.79;

  const centerLat = (validStartLat + validEndLat) / 2;
  const centerLng = (validStartLng + validEndLng) / 2;

  const routeAPositions = buildPolylinePositions(routeA);
  const routeBPositions = buildPolylinePositions(routeB);

  const fallbackA: Coordinate[] = [
    [validStartLat, validStartLng],
    [validEndLat, validEndLng],
  ];

  const midLat = (validStartLat + validEndLat) / 2;
  const midLng = (validStartLng + validEndLng) / 2;
  const fallbackB: Coordinate[] = [
    [validStartLat, validStartLng],
    [midLat + 0.12, midLng - 0.15],
    [validEndLat, validEndLng],
  ];

  const finalA = routeAPositions.length >= 2 ? routeAPositions : fallbackA;
  const finalB = routeBPositions.length >= 2 ? routeBPositions : fallbackB;

  const allBounds: Coordinate[] = [
    [validStartLat, validStartLng],
    [validEndLat, validEndLng],
    ...finalA,
    ...finalB,
  ];

  return (
    <div
      style={{
        height: '55vh',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #374151',
        position: 'relative',
      }}
    >
      {/* Provider Switcher */}
      <div className="absolute top-2 left-2 z-[1000] flex items-center gap-2 bg-gray-900/95 backdrop-blur border border-gray-700 p-1 rounded-lg text-xs shadow-lg">
        <button
          onClick={() => setMapProvider('mappls')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
            mapProvider === 'mappls'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <span>🇮🇳</span>
          <span>Mappls Map</span>
          <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded text-orange-200">Active</span>
        </button>
        <button
          onClick={() => setMapProvider('osm')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
            mapProvider === 'osm'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <span>🌐</span>
          <span>OpenStreetMap</span>
        </button>
      </div>

      {mapProvider === 'mappls' ? (
        <MapplsDriverMap
          startLat={validStartLat}
          startLng={validStartLng}
          endLat={validEndLat}
          endLng={validEndLng}
          startLabel={startLabel}
          endLabel={endLabel}
          routeAPositions={finalA}
          routeBPositions={finalB}
          routeARisk={routeA?.total_risk}
          routeBRisk={routeB?.total_risk}
          isRouteBRecommended={isRouteBRecommended}
          onFallback={() => setMapProvider('osm')}
        />
      ) : (
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
      >
        <MapBoundsUpdater bounds={allBounds} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Route A (Direct / Shortest) */}
        {finalA.length >= 2 && (
          <Polyline
            positions={finalA}
            pathOptions={{
              color: !isRouteBRecommended ? '#22c55e' : '#ef4444',
              weight: !isRouteBRecommended ? 6 : 5,
              dashArray: isRouteBRecommended ? '8,6' : undefined,
              opacity: !isRouteBRecommended ? 0.95 : 0.85,
            }}
          >
            <Popup>
              <div className="text-xs text-gray-900">
                <strong className={!isRouteBRecommended ? 'text-green-600' : 'text-red-600'}>
                  Route A (Direct / Shortest) {!isRouteBRecommended ? '— Recommended ✅' : ''}
                </strong>
                <br />
                Risk Score: {routeA?.total_risk ?? '35'}/100 {!isRouteBRecommended ? '🟢' : '🔴'}
                <br />
                ETA: {routeA ? `${Math.floor(routeA.time_min / 60)}h ${routeA.time_min % 60}m` : '4h 10m'}
              </div>
            </Popup>
          </Polyline>
        )}

        {/* Route B (Alternative Detour) */}
        {finalB.length >= 2 && (
          <Polyline
            positions={finalB}
            pathOptions={{
              color: isRouteBRecommended ? '#22c55e' : '#3b82f6',
              weight: isRouteBRecommended ? 6 : 4,
              opacity: isRouteBRecommended ? 0.95 : 0.75,
            }}
          >
            <Popup>
              <div className="text-xs text-gray-900">
                <strong className={isRouteBRecommended ? 'text-green-600' : 'text-blue-600'}>
                  Route B (Alternative) {isRouteBRecommended ? '— Recommended ✅' : ''}
                </strong>
                <br />
                Risk Score: {routeB?.total_risk ?? '28'}/100 🟢
                <br />
                ETA: {routeB ? `${Math.floor(routeB.time_min / 60)}h ${routeB.time_min % 60}m` : '4h 45m'}
              </div>
            </Popup>
          </Polyline>
        )}

        {/* Start Marker */}
        <Marker position={[validStartLat, validStartLng]} icon={startIcon}>
          <Popup>
            <div className="text-xs text-gray-900">
              <strong>Start:</strong> {startLabel}
              <br />
              <small className="text-gray-500">
                ({validStartLat.toFixed(4)}, {validStartLng.toFixed(4)})
              </small>
            </div>
          </Popup>
        </Marker>

        {/* Destination Marker */}
        <Marker position={[validEndLat, validEndLng]} icon={endIcon}>
          <Popup>
            <div className="text-xs text-gray-900">
              <strong>Destination:</strong> {endLabel}
              <br />
              <small className="text-gray-500">
                ({validEndLat.toFixed(4)}, {validEndLng.toFixed(4)})
              </small>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      )}
    </div>
  );
}
