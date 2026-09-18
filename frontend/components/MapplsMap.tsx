'use client';
import { useEffect, useRef, useState } from 'react';

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

interface Incident {
  id: number;
  incident_type: string;
  severity: string;
  verified: boolean;
  location: { lat: number; lng: number };
  description: string;
  confidence_pct: number;
  created_at: string;
}

interface RoadSegment {
  id: number;
  name: string;
  district: string;
  start?: { lat: number; lng: number };
  end?: { lat: number; lng: number };
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
  current_risk_score: number;
  risk_label: string;
  rainfall_factor: number;
  slope_risk: number;
  incident_factor: number;
  traffic_factor: number;
  road_condition_score: number;
  is_critical_corridor: boolean;
  blocked: boolean;
}

interface MapplsMapProps {
  vehicles: Vehicle[];
  incidents: Incident[];
  segments: RoadSegment[];
  onFallback?: () => void;
}

export default function MapplsMap({ vehicles, incidents, segments, onFallback }: MapplsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // 1. Ensure Mappls Web SDK is loaded
  useEffect(() => {
    let checkTimer: any;
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max

    const checkMappls = () => {
      if (typeof window !== 'undefined' && (window as any).mappls && (window as any).mappls.Map) {
        setSdkReady(true);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          setInitError('Mappls SDK timed out loading.');
          if (onFallback) onFallback();
        } else {
          checkTimer = setTimeout(checkMappls, 500);
        }
      }
    };

    checkMappls();

    return () => {
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [onFallback]);

  // 2. Initialize map instance
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const mappls = (window as any).mappls;
      const map = new mappls.Map(mapContainerRef.current, {
        center: [26.0, 92.0], // Centered on Northeast India
        zoom: 7,
        zoomControl: true,
        hybrid: false,
      });

      mapInstanceRef.current = map;
    } catch (e: any) {
      console.error('Failed to init Mappls map:', e);
      setInitError(e?.message || 'Error initializing Mappls map.');
    }
  }, [sdkReady]);

  // 3. Render Segments, Vehicles, and Incidents onto the Mappls Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = (typeof window !== 'undefined' && (window as any).mappls);
    if (!map || !mappls) return;

    // Clear previous overlays
    overlaysRef.current.forEach((item) => {
      try {
        if (item && typeof item.remove === 'function') {
          item.remove();
        }
      } catch {}
    });
    overlaysRef.current = [];

    // Helper for segment color
    const getSegmentColor = (seg: RoadSegment) => {
      if (seg.blocked) return '#7f1d1d';
      if (seg.risk_label === 'HIGH') return '#dc2626';
      if (seg.risk_label === 'MODERATE') return '#f97316';
      return '#22c55e';
    };

    // A. Render Road Segments
    segments.forEach((seg) => {
      const sLat = Number(seg.start?.lat ?? seg.start_lat);
      const sLng = Number(seg.start?.lng ?? seg.start_lng);
      const eLat = Number(seg.end?.lat ?? seg.end_lat);
      const eLng = Number(seg.end?.lng ?? seg.end_lng);

      if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) return;

      try {
        const polyline = new mappls.Polyline({
          map: map,
          path: [
            { lat: sLat, lng: sLng },
            { lat: eLat, lng: eLng },
          ],
          strokeColor: getSegmentColor(seg),
          strokeWeight: seg.is_critical_corridor ? 7 : 5,
          strokeOpacity: 0.85,
        });

        // Popup content
        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;min-width:200px;color:#111;">
            <div style="font-weight:bold;font-size:13px;margin-bottom:4px;">🛣️ ${seg.name}</div>
            <div style="font-size:11px;color:#555;margin-bottom:4px;">District: ${seg.district}</div>
            <div style="font-weight:bold;color:${getSegmentColor(seg)};font-size:12px;margin-bottom:4px;">
              Risk: ${seg.current_risk_score}/100 (${seg.risk_label})
            </div>
            <div style="font-size:11px;color:#666;">
              🌧️ Rain: +${seg.rainfall_factor} | ⛰️ Slope: +${seg.slope_risk} | ⚠️ Incidents: +${seg.incident_factor}
            </div>
          </div>
        `;

        if (typeof polyline.addListener === 'function') {
          polyline.addListener('click', () => {
            new mappls.InfoWindow({
              map: map,
              content: popupHtml,
              position: { lat: (sLat + eLat) / 2, lng: (sLng + eLng) / 2 },
            });
          });
        }

        overlaysRef.current.push(polyline);
      } catch (err) {
        console.warn('Mappls polyline error:', err);
      }
    });

    // B. Render Vehicles
    vehicles.forEach((v) => {
      const vLat = Number(v.location?.lat);
      const vLng = Number(v.location?.lng);
      if (isNaN(vLat) || isNaN(vLng)) return;

      try {
        const marker = new mappls.Marker({
          map: map,
          position: { lat: vLat, lng: vLng },
          title: `🚚 Vehicle #${v.id} (${v.driver_name})`,
        });

        const vInfo = `
          <div style="font-family:system-ui,sans-serif;min-width:180px;color:#111;">
            <div style="font-weight:bold;font-size:13px;margin-bottom:4px;">🚚 Vehicle #${v.id}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Driver:</b> ${v.driver_name}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Cargo:</b> ${v.payload_type}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Priority:</b> ${v.priority}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Destination:</b> ${v.destination_name}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>ETA:</b> ${v.eta_hours}h</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Load:</b> ${v.current_load_pct}%</div>
          </div>
        `;

        if (typeof marker.addListener === 'function') {
          marker.addListener('click', () => {
            new mappls.InfoWindow({
              map: map,
              content: vInfo,
              position: { lat: vLat, lng: vLng },
            });
          });
        }

        overlaysRef.current.push(marker);
      } catch (err) {
        console.warn('Mappls vehicle marker error:', err);
      }
    });

    // C. Render Incidents
    incidents.forEach((inc) => {
      const iLat = Number(inc.location?.lat);
      const iLng = Number(inc.location?.lng);
      if (isNaN(iLat) || isNaN(iLng)) return;

      try {
        const incMarker = new mappls.Marker({
          map: map,
          position: { lat: iLat, lng: iLng },
          title: `⚠️ ${inc.incident_type}`,
        });

        const incInfo = `
          <div style="font-family:system-ui,sans-serif;min-width:180px;color:#111;">
            <div style="font-weight:bold;font-size:13px;color:#dc2626;margin-bottom:4px;">⚠️ ${inc.incident_type}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Severity:</b> ${inc.severity}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Verified:</b> ${inc.verified ? 'Yes' : 'No'}</div>
            <div style="font-size:11px;margin-bottom:2px;"><b>Confidence:</b> ${inc.confidence_pct}%</div>
            <div style="font-size:11px;margin-bottom:2px;">${inc.description || 'No description provided.'}</div>
          </div>
        `;

        if (typeof incMarker.addListener === 'function') {
          incMarker.addListener('click', () => {
            new mappls.InfoWindow({
              map: map,
              content: incInfo,
              position: { lat: iLat, lng: iLng },
            });
          });
        }

        overlaysRef.current.push(incMarker);
      } catch (err) {
        console.warn('Mappls incident marker error:', err);
      }
    });
  }, [sdkReady, vehicles, incidents, segments]);

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-300 p-6 text-center">
        <div className="text-3xl mb-2">🗺️</div>
        <p className="font-semibold text-sm">Mappls Map SDK Notice</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">{initError}</p>
        {onFallback && (
          <button
            onClick={onFallback}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-all"
          >
            Switch to OpenStreetMap
          </button>
        )}
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-400 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium">Connecting to Mappls Map Engine...</p>
        <span className="text-[10px] text-gray-500">Key: idcbzgnknzuqlwhektvbhzgiksexnptuzhpj</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        id="mappls-map-container"
        style={{ width: '100%', height: '100%', minHeight: '500px' }}
      />
      {/* Branding Badge */}
      <div className="absolute bottom-2 left-2 z-[10] bg-gray-900/90 backdrop-blur border border-gray-700 px-3 py-1 rounded-md text-[11px] text-gray-300 flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span>Powered by <b>Mappls</b> (MapmyIndia)</span>
      </div>
    </div>
  );
}
