import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FieldPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}

