'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/(protected)/layout';
import { removeTokens } from '@/lib/auth';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión de la aplicación?')) {
      removeTokens();
      router.replace('/login');
    }
  };

  if (!user) return null;

  const isJobActive = pathname === '/tecnico' || pathname.startsWith('/tecnico/') || pathname.startsWith('/ordenes');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-zinc-200 flex justify-around items-center h-[68px] z-45 pb-safe px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {/* 1. Home */}
      <Link
        href="/dashboard"
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
          pathname === '/dashboard' ? 'text-green-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${
          pathname === '/dashboard' ? 'bg-green-50 text-green-600 shadow-[0_0_12px_rgba(22,163,74,0.3)] ring-1 ring-green-200' : ''
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <span className="text-[11px] font-medium tracking-tight">Home</span>
      </Link>

      {/* 2. Job / Item (SELECCIONADO CON RESPLANDOR VERDE) */}
      <Link
        href="/tecnico"
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
          isJobActive ? 'text-green-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${
          isJobActive ? 'bg-green-50 text-green-600 shadow-[0_0_15px_rgba(22,163,74,0.35)] ring-1 ring-green-200' : ''
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <span className="text-[11px] font-medium tracking-tight">Job</span>
      </Link>

      {/* 3. BOTÓN CENTRAL DE IA / ROBOT */}
      <button
        type="button"
        onClick={() => alert('Asistente IA de Diagnóstico activado')}
        className="flex flex-col items-center justify-center shrink-0 -translate-y-3 group active:scale-90 transition-all duration-200 z-50 px-1 cursor-pointer"
        title="Asistente de IA"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(22,163,74,0.4)] ring-4 ring-white group-hover:scale-105 transition-all">
          <svg className="w-6 h-6 stroke-[2.2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v1.244m4.5 0V3.104M12 3v1.244M4.5 8.25h15m-15 4.5h15m-15 4.5h15M6.75 6h10.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25V8.25A2.25 2.25 0 016.75 6z" />
          </svg>
        </div>
        <span className="text-[9px] font-black tracking-tight text-green-600 mt-0.5">
          IA Bot
        </span>
      </button>

      {/* 4. Customers */}
      <Link
        href="/clientes"
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
          pathname === '/clientes' ? 'text-green-600 font-bold' : 'text-zinc-500 hover:text-zinc-800'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${
          pathname === '/clientes' ? 'bg-green-50 text-green-600 shadow-[0_0_12px_rgba(22,163,74,0.3)] ring-1 ring-green-200' : ''
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <span className="text-[11px] font-medium tracking-tight">Customers</span>
      </Link>

      {/* 5. More */}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-zinc-500 hover:text-zinc-800 active:scale-95 cursor-pointer"
        title="More Options / Salir"
      >
        <div className="p-1.5 rounded-xl">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </div>
        <span className="text-[11px] font-medium tracking-tight">More</span>
      </button>
    </div>
  );
};
