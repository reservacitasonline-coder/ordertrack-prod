'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`,
    });
    setCargando(false);
    // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados
    if (err && err.status !== 400) {
      setError('No se pudo enviar el correo. Intente de nuevo en unos minutos.');
      return;
    }
    setEnviado(true);
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-zinc-50 px-4">
      <div className="w-full max-w-md bg-white border border-zinc-200/80 rounded-2xl p-6 md:p-8 shadow-md">
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">Recuperar contraseña</h3>
        {enviado ? (
          <p className="text-xs text-zinc-700 leading-relaxed">
            Si el correo está registrado, recibirá un enlace para crear una nueva contraseña. Revise también
            la carpeta de spam.
          </p>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
            )}
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button type="submit" isLoading={cargando} className="w-full">
              Enviar enlace
            </Button>
          </form>
        )}
        <Link href="/login" className="block mt-5 text-xs text-teal-700 hover:underline text-center">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
