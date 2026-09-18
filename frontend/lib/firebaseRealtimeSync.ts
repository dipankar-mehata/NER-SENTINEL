import {
  collection, doc, onSnapshot, setDoc, addDoc,
  updateDoc, serverTimestamp, query, where, orderBy, limit,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

// ── Retry helper ─────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Types ─────────────────────────────────────────────────────────
export interface FirebaseVehicle {
  id: string;
  driverName: string;
  status: 'online' | 'offline' | 'en-route' | 'stopped';
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy?: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  payloadType: string;
  priority: 'HIGH' | 'MODERATE' | 'LOW';
  currentLoadPct: number;
  updatedAt: Timestamp | null;
}

export interface SOSAlert {
  id: string;
  vehicleId: string;
  driverName: string;
  lat: number;
  lng: number;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  resolved: boolean;
  createdAt: Timestamp | null;
}

export interface SupplyItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  priority: 'HIGH' | 'MODERATE' | 'LOW';
  assignedVehicleId: string | null;
  status: 'pending' | 'in-transit' | 'delivered';
  updatedAt: Timestamp | null;
}

export interface ActiveRoute {
  vehicleId: string;
  segments: Array<{ lat: number; lng: number; risk: number; color: string }>;
  totalRiskScore: number;
  estimatedTimeMin: number;
  rerouteFlag: boolean;
  updatedAt: Timestamp | null;
}

export interface RerouteEvent {
  id: string;
  vehicleId: string;
  reason: 'weather' | 'disaster' | 'admin';
  oldRouteSummary: string;
  newRouteSummary: string;
  triggeredAt: Timestamp | null;
  acknowledged: boolean;
}

// ── Firebase is available only when a project is configured ───────
export const isFirebaseConfigured = () =>
  typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'string' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== '' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'your-project-id';

// ── Hooks ─────────────────────────────────────────────────────────
export function useVehicles(): FirebaseVehicle[] {
  const [vehicles, setVehicles] = useState<FirebaseVehicle[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      collection(db, 'vehicles'),
      (snap) => {
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirebaseVehicle)));
      },
      (err) => console.error('[Firebase] vehicles snapshot error:', err)
    );
    return unsub;
  }, []);

  return vehicles;
}

export function useSOSAlerts(): SOSAlert[] {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const q = query(
      collection(db, 'sos_alerts'),
      where('resolved', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SOSAlert)));
      },
      (err) => console.error('[Firebase] sos_alerts error:', err)
    );
    return unsub;
  }, []);

  return alerts;
}

export function useSupplyItems(): SupplyItem[] {
  const [items, setItems] = useState<SupplyItem[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      collection(db, 'supply_items'),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplyItem)));
      },
      (err) => console.error('[Firebase] supply_items error:', err)
    );
    return unsub;
  }, []);

  return items;
}

export function useActiveRoute(vehicleId: string | null): ActiveRoute | null {
  const [route, setRoute] = useState<ActiveRoute | null>(null);

  useEffect(() => {
    if (!vehicleId || !isFirebaseConfigured()) return;
    const unsub = onSnapshot(doc(db, 'active_routes', vehicleId), (snap) => {
      if (snap.exists()) {
        setRoute({ vehicleId, ...snap.data() } as ActiveRoute);
      } else {
        setRoute(null);
      }
    });
    return unsub;
  }, [vehicleId]);

  return route;
}

export function useRerouteEvents(vehicleId: string | null): RerouteEvent[] {
  const [events, setEvents] = useState<RerouteEvent[]>([]);

  useEffect(() => {
    if (!vehicleId || !isFirebaseConfigured()) return;
    const q = query(
      collection(db, 'reroute_events'),
      where('vehicleId', '==', vehicleId),
      where('acknowledged', '==', false),
      orderBy('triggeredAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as RerouteEvent))
      );
    });
    return unsub;
  }, [vehicleId]);

  return events;
}

// ── Hook: Real-time single driver stream ─────────────────────────
export function useDriverStream(vehicleId: string | null): FirebaseVehicle | null {
  const [vehicle, setVehicle] = useState<FirebaseVehicle | null>(null);

  useEffect(() => {
    if (!vehicleId || !isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      doc(db, 'vehicles', vehicleId),
      (snap) => {
        if (snap.exists()) setVehicle({ id: snap.id, ...snap.data() } as FirebaseVehicle);
      },
      (err) => console.error('[Firebase] driver stream error:', err)
    );
    return unsub;
  }, [vehicleId]);

  return vehicle;
}

// ── Write Helpers ─────────────────────────────────────────────────
export async function publishVehicleLocation(
  vehicleId: string,
  lat: number,
  lng: number,
  heading: number,
  speed: number,
  extraData?: Partial<FirebaseVehicle>
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      setDoc(
        doc(db, 'vehicles', vehicleId),
        { lat, lng, heading, speed, status: 'en-route', updatedAt: serverTimestamp(), ...extraData },
        { merge: true }
      )
    );
  } catch (err) {
    console.error('[Firebase] publishVehicleLocation failed:', err);
  }
}

export async function setDriverStatus(
  vehicleId: string,
  status: 'online' | 'offline' | 'en-route' | 'stopped',
  extraData?: Partial<FirebaseVehicle>
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      setDoc(
        doc(db, 'vehicles', vehicleId),
        { status, updatedAt: serverTimestamp(), ...extraData },
        { merge: true }
      )
    );
  } catch (err) {
    console.error('[Firebase] setDriverStatus failed:', err);
  }
}

export async function triggerSOS(
  vehicleId: string,
  driverName: string,
  lat: number,
  lng: number,
  message: string
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      addDoc(collection(db, 'sos_alerts'), {
        vehicleId, driverName, lat, lng, message,
        severity: 'CRITICAL', resolved: false, createdAt: serverTimestamp(),
      })
    );
  } catch (err) {
    console.error('[Firebase] triggerSOS failed:', err);
  }
}

export async function resolveSOSAlert(alertId: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() => updateDoc(doc(db, 'sos_alerts', alertId), { resolved: true }));
  } catch (err) {
    console.error('[Firebase] resolveSOSAlert failed:', err);
  }
}

export async function updateSupplyPriority(
  itemId: string,
  priority: 'HIGH' | 'MODERATE' | 'LOW'
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      updateDoc(doc(db, 'supply_items', itemId), { priority, updatedAt: serverTimestamp() })
    );
  } catch (err) {
    console.error('[Firebase] updateSupplyPriority failed:', err);
  }
}

export async function pushRerouteEvent(
  vehicleId: string,
  reason: 'weather' | 'disaster' | 'admin',
  oldRouteSummary: string,
  newRouteSummary: string
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      addDoc(collection(db, 'reroute_events'), {
        vehicleId, reason, oldRouteSummary, newRouteSummary,
        acknowledged: false, triggeredAt: serverTimestamp(),
      })
    );
  } catch (err) {
    console.error('[Firebase] pushRerouteEvent failed:', err);
  }
}

export async function acknowledgeReroute(eventId: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() => updateDoc(doc(db, 'reroute_events', eventId), { acknowledged: true }));
  } catch (err) {
    console.error('[Firebase] acknowledgeReroute failed:', err);
  }
}

export async function setActiveRoute(
  vehicleId: string,
  segments: ActiveRoute['segments'],
  totalRiskScore: number,
  estimatedTimeMin: number,
  rerouteFlag = false
) {
  if (!isFirebaseConfigured()) return;
  try {
    await withRetry(() =>
      setDoc(doc(db, 'active_routes', vehicleId), {
        segments, totalRiskScore, estimatedTimeMin, rerouteFlag,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    console.error('[Firebase] setActiveRoute failed:', err);
  }
}
