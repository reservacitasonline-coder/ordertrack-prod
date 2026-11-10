'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrentUser } from '@/types';
import { Spinner } from '@/components/ui/Spinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((user: CurrentUser | null) => {
        router.replace(user ? (user.rol === 'tecnico' ? '/tecnico' : '/dashboard') : '/login');
      });
  }, [router]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-zinc-50">
      <Spinner size="lg" />
      <span className="text-xs text-zinc-400 font-medium mt-3">Redirigiendo...</span>
    </div>
  );
}
