import {
  collection, doc, onSnapshot, setDoc, addDoc,
  updateDoc, serverTimestamp, query, where, orderBy, limit,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────
export interface FirebaseVehicle {
  id: string;
  driverName: string;
  status: 'online' | 'offline' | 'en-route' | 'stopped';
  lat: number;
  lng: number;
  speed: number;
  heading: number;
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
const isFirebaseConfigured = () =>
  typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'string' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== '' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'your-project-id';

// ── Hooks ─────────────────────────────────────────────────────────
export function useVehicles(): FirebaseVehicle[] {
  const [vehicles, setVehicles] = useState<FirebaseVehicle[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirebaseVehicle))
      );
    });
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
    const unsub = onSnapshot(q, (snap) => {
      setAlerts(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as SOSAlert))
      );
    });
    return unsub;
  }, []);

  return alerts;
}

export function useSupplyItems(): SupplyItem[] {
  const [items, setItems] = useState<SupplyItem[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(collection(db, 'supply_items'), (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplyItem))
      );
    });
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
  await setDoc(
    doc(db, 'vehicles', vehicleId),
    { lat, lng, heading, speed, status: 'en-route', updatedAt: serverTimestamp(), ...extraData },
    { merge: true }
  );
}

export async function triggerSOS(
  vehicleId: string,
  driverName: string,
  lat: number,
  lng: number,
  message: string
) {
  if (!isFirebaseConfigured()) return;
  await addDoc(collection(db, 'sos_alerts'), {
    vehicleId,
    driverName,
    lat,
    lng,
    message,
    severity: 'CRITICAL',
    resolved: false,
    createdAt: serverTimestamp(),
  });
}

export async function resolveSOSAlert(alertId: string) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(db, 'sos_alerts', alertId), { resolved: true });
}

export async function updateSupplyPriority(
  itemId: string,
  priority: 'HIGH' | 'MODERATE' | 'LOW'
) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(db, 'supply_items', itemId), {
    priority,
    updatedAt: serverTimestamp(),
  });
}

export async function pushRerouteEvent(
  vehicleId: string,
  reason: 'weather' | 'disaster' | 'admin',
  oldRouteSummary: string,
  newRouteSummary: string
) {
  if (!isFirebaseConfigured()) return;
  await addDoc(collection(db, 'reroute_events'), {
    vehicleId,
    reason,
    oldRouteSummary,
    newRouteSummary,
    acknowledged: false,
    triggeredAt: serverTimestamp(),
  });
}

export async function acknowledgeReroute(eventId: string) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(db, 'reroute_events', eventId), { acknowledged: true });
}

export async function setActiveRoute(
  vehicleId: string,
  segments: ActiveRoute['segments'],
  totalRiskScore: number,
  estimatedTimeMin: number,
  rerouteFlag = false
) {
  if (!isFirebaseConfigured()) return;
  await setDoc(doc(db, 'active_routes', vehicleId), {
    segments,
    totalRiskScore,
    estimatedTimeMin,
    rerouteFlag,
    updatedAt: serverTimestamp(),
  });
}
