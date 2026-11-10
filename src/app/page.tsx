'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/auth';
import { Spinner } from '@/components/ui/Spinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUserProfile().then((user) => {
      if (user) {
        router.replace(user.rol === 'tecnico' ? '/tecnico' : '/dashboard');
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-zinc-50">
      <Spinner size="lg" />
      <span className="text-xs text-zinc-400 font-medium mt-3">Redirigiendo...</span>
    </div>
  );
}
