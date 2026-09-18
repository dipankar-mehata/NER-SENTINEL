import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DistrictRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/command'); }, [router]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Satoshi, sans-serif', background: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
        <div style={{ fontWeight: 700, color: '#111' }}>Redirecting to Command Center…</div>
        <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>District Officer view has merged into the Logistics Command Center.</div>
      </div>
    </div>
  );
}
