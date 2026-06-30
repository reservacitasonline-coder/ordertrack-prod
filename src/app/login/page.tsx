'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { apiFetch } from '@/lib/api';
import { setTokens, getAccessToken } from '@/lib/auth';
import { TokenResponse } from '@/types';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const token = getAccessToken();
    if (token) {
      router.replace('/dashboard');
    }

    // Check if redirect due to expired session
    if (searchParams.get('expired') === 'true') {
      Promise.resolve().then(() => {
        setError('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
      });
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, complete todos los campos.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      setTokens(response.access_token, response.refresh_token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex w-12 h-12 rounded-xl bg-teal-600 items-center justify-center text-white font-bold text-2xl shadow-md shadow-teal-900/20 mb-3">
          O
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">OrderTrack SaaS</h2>
        <p className="text-xs text-zinc-500 mt-1.5">
          Micro-SaaS para control de Órdenes de Trabajo Multi-Cliente
        </p>
      </div>

      {/* Card Form */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 md:p-8 shadow-md">
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">Ingresar al Sistema</h3>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="ejemplo@ordertrack.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" isLoading={isLoading} className="w-full mt-2">
            Iniciar Sesión
          </Button>
        </form>
      </div>

      {/* Demo Credentials Hint */}
      <div className="mt-6 text-center text-[10px] text-zinc-400 bg-white/60 border border-zinc-100 rounded-xl p-3 backdrop-blur-xs">
        <p className="font-semibold text-zinc-500 mb-1">Credenciales de Prueba Sembradas:</p>
        <p className="mb-0.5"><span className="font-medium text-zinc-500">Admin Alpha:</span> admin_alpha@ordertrack.com / alpha_admin_123</p>
        <p><span className="font-medium text-zinc-500">Admin Beta:</span> admin_beta@ordertrack.com / beta_admin_123</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-zinc-50 px-4">
      {/* Visual background decoration */}
      <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-teal-500/10 to-transparent -z-10" />
      <Suspense fallback={
        <div className="flex flex-col items-center">
          <Spinner size="lg" />
          <span className="text-xs text-zinc-400 font-medium mt-3">Iniciando formulario...</span>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
