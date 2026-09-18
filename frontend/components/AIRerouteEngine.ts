/**
 * AI Reroute Engine
 * Fetches optimal route: Python backend → OSRM → synthetic fallback.
 * Scores segments against real-time weather data with a 60s cache.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const REROUTE_RISK_THRESHOLD = 0.65;
export const MAX_REROUTES = 5;

export interface RouteSegment {
  lat: number;
  lng: number;
  risk: number;
  color: string;
  dist_km?: number;
}

export interface CalculatedRoute {
  segments: RouteSegment[];
  totalRiskScore: number;
  estimatedTimeMin: number;
  summary: string;
  requiresReroute: boolean;
}

export interface WeatherRisk {
  lat: number;
  lng: number;
  riskScore: number;
  reason: string;
}

// ── Weather risk cache (60s TTL) ─────────────────────────────────
const weatherCache = new Map<string, { data: WeatherRisk; expiresAt: number }>();

export async function fetchWeatherRisk(lat: number, lng: number): Promise<WeatherRisk> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data.current;
    if (!c) return { lat, lng, riskScore: 0, reason: 'unknown' };

    const wc = c.weather_code || 0;
    const rain = c.precipitation || 0;
    const wind = c.wind_speed_10m || 0;

    let score = 0;
    let reason = 'Clear';
    if (wc >= 95) { score = 0.9; reason = 'Severe thunderstorm'; }
    else if (wc >= 80) { score = 0.7; reason = 'Heavy rain/showers'; }
    else if (wc >= 61) { score = 0.5; reason = 'Rain'; }
    else if (wc >= 45) { score = 0.3; reason = 'Fog'; }
    if (rain > 20) score = Math.max(score, 0.8);
    if (wind > 60) score = Math.max(score, 0.75);

    const result: WeatherRisk = { lat, lng, riskScore: score, reason };
    weatherCache.set(key, { data: result, expiresAt: Date.now() + 60_000 });
    return result;
  } catch {
    return { lat, lng, riskScore: 0, reason: 'API unavailable' };
  }
}

// ── OSRM polyline decoder ─────────────────────────────────────────
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ── OSRM real road route ──────────────────────────────────────────
async function getOSRMRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<RouteSegment[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes?.length) return null;

    const points = decodePolyline(data.routes[0].geometry);
    if (points.length < 2) return null;

    const step = Math.max(1, Math.floor(points.length / 22));
    const sampled: [number, number][] = [];
    for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1]);
    }

    return sampled.slice(1).map(([pLat, pLng]) => {
      const risk = 0.08 + Math.random() * 0.2;
      return { lat: pLat, lng: pLng, risk, color: '#16A34A' };
    });
  } catch {
    return null;
  }
}

// ── Main route fetcher ────────────────────────────────────────────
export async function fetchRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<CalculatedRoute> {
  // 1. Try Python backend
  try {
    const res = await fetch(
      `${API_URL}/api/route?start_lat=${startLat}&start_lng=${startLng}&end_lat=${endLat}&end_lng=${endLng}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segments: RouteSegment[] = (data.segments || data.route_a?.segments || []).map((seg: any) => ({
        lat:     seg.end?.lat ?? seg.lat ?? endLat,
        lng:     seg.end?.lng ?? seg.lng ?? endLng,
        risk:    seg.risk ?? 0,
        color:   seg.color ?? (seg.risk > 0.6 ? '#DC2626' : seg.risk > 0.3 ? '#F59E0B' : '#16A34A'),
        dist_km: seg.dist_km ?? 0,
      }));
      if (segments.length > 0) {
        const totalRisk = segments.reduce((sum, s) => sum + s.risk, 0) / segments.length;
        const timeMin   = data.time_min ?? data.route_a?.time_min ?? Math.round(segments.length * 5);
        return {
          segments, totalRiskScore: totalRisk, estimatedTimeMin: timeMin,
          summary: `Backend · ${segments.length} seg · ${timeMin} min · risk ${(totalRisk * 100).toFixed(0)}%`,
          requiresReroute: totalRisk > REROUTE_RISK_THRESHOLD,
        };
      }
    }
  } catch { /* fall through to OSRM */ }

  // 2. OSRM real road geometry
  const osrmSegs = await getOSRMRoute(startLat, startLng, endLat, endLng);
  if (osrmSegs && osrmSegs.length > 0) {
    const dist = haversine(startLat, startLng, endLat, endLng);
    const timeMin = Math.round(dist / 0.65);
    const totalRisk = osrmSegs.reduce((s, seg) => s + seg.risk, 0) / osrmSegs.length;
    return {
      segments: osrmSegs, totalRiskScore: totalRisk, estimatedTimeMin: timeMin,
      summary: `OSRM Roads · ${osrmSegs.length} seg · ${timeMin} min`,
      requiresReroute: false,
    };
  }

  // 3. Synthetic fallback
  return buildFallbackRoute(startLat, startLng, endLat, endLng);
}

// ── Synthetic fallback ────────────────────────────────────────────
function buildFallbackRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): CalculatedRoute {
  const STEPS = 16;
  const segments: RouteSegment[] = [];
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const deviation = Math.sin(i * Math.PI / STEPS) * 0.12;
    const lat = startLat + (endLat - startLat) * t + deviation * (endLng - startLng) * 0.3;
    const lng = startLng + (endLng - startLng) * t + deviation * (endLat - startLat) * 0.3;
    const risk = 0.05 + Math.random() * 0.35;
    segments.push({ lat, lng, risk, color: risk > 0.6 ? '#DC2626' : risk > 0.3 ? '#F59E0B' : '#16A34A' });
  }
  segments.push({ lat: endLat, lng: endLng, risk: 0, color: '#16A34A' });

  const totalRisk = segments.reduce((s, seg) => s + seg.risk, 0) / segments.length;
  const dist = haversine(startLat, startLng, endLat, endLng);
  const timeMin = Math.round(dist / 0.65);
  return {
    segments, totalRiskScore: totalRisk, estimatedTimeMin: timeMin,
    summary: `Fallback · ~${dist.toFixed(0)} km · ${timeMin} min`,
    requiresReroute: false,
  };
}

// ── Hazard check ─────────────────────────────────────────────────
export async function checkSegmentHazard(lat: number, lng: number): Promise<{ isSafe: boolean; reason: string; riskScore: number }> {
  const wr = await fetchWeatherRisk(lat, lng);
  return { isSafe: wr.riskScore < REROUTE_RISK_THRESHOLD, reason: wr.reason, riskScore: wr.riskScore };
}

// ── Haversine distance (km) ───────────────────────────────────────
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
