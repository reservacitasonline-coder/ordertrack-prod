'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

export default function RestablecerPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== repetir) return setError('Las contraseñas no coinciden.');
    setCargando(true);
    setError(null);
    const { error: err } = await createClient().auth.updateUser({ password });
    setCargando(false);
    if (err) return setError(err.message);
    router.replace('/');
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-zinc-50 px-4">
      <div className="w-full max-w-md bg-white border border-zinc-200/80 rounded-2xl p-6 md:p-8 shadow-md">
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">Nueva contraseña</h3>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
          )}
          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Repetir contraseña"
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" isLoading={cargando} className="w-full">
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
