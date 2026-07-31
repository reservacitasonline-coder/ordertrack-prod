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

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md text-zinc-400 border-t border-zinc-900 flex justify-around items-center h-16 z-45 pb-safe px-1.5">
      {/* 1. Inicio */}
      <Link
        href={user.rol === 'tecnico' ? '/tecnico' : '/dashboard'}
        className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
          isActive(user.rol === 'tecnico' ? '/tecnico' : '/dashboard') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
        <span className="text-[9px] tracking-tight">Inicio</span>
      </Link>

      {/* 2. Órdenes / Empresas */}
      {user.rol === 'superadmin' ? (
        <Link
          href="/empresas"
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isActive('/empresas') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-[9px] tracking-tight">Empresas</span>
        </Link>
      ) : (
        <Link
          href="/ordenes"
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isActive('/ordenes') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-[9px] tracking-tight">Órdenes</span>
        </Link>
      )}

      {/* 3. Clientes (Para admin y operador) */}
      {(user.rol === 'admin' || user.rol === 'operador') && (
        <Link
          href="/clientes"
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isActive('/clientes') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[9px] tracking-tight">Clientes</span>
        </Link>
      )}

      {/* 4. CENTER SOCIAL NETWORK ACTION BUTTON: CREAR OT */}
      {user.rol !== 'tecnico' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pathname === '/ordenes') {
              window.dispatchEvent(new Event('open-crear-ot'));
            } else {
              router.push('/ordenes?crear=true');
              setTimeout(() => {
                window.dispatchEvent(new Event('open-crear-ot'));
              }, 120);
            }
          }}
          className="flex flex-col items-center justify-center shrink-0 -translate-y-3.5 group active:scale-90 transition-all duration-200 z-50 px-1 cursor-pointer"
          title="Crear Nueva OT"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-teal-500/40 ring-4 ring-zinc-950 group-hover:scale-105 transition-all">
            <svg className="w-6 h-6 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-[9px] font-black tracking-tight text-teal-400 mt-0.5 group-hover:text-teal-300">
            Crear OT
          </span>
        </button>
      )}

      {/* 5. Mi Vehículo (Técnico) o Usuarios (Admin / Superadmin) */}
      {user.rol === 'tecnico' ? (
        <Link
          href="/inventario/transferir"
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isActive('/inventario/transferir') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[9px] tracking-tight">Mi Vehículo</span>
        </Link>
      ) : (user.rol === 'admin' || user.rol === 'superadmin') ? (
        <Link
          href="/usuarios"
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-95 ${
            isActive('/usuarios') ? 'text-teal-400 font-bold' : 'hover:text-zinc-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-[9px] tracking-tight">Usuarios</span>
        </Link>
      ) : null}

      {/* 6. Salir */}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-1 flex-1 py-1 text-zinc-400 hover:text-zinc-200 active:scale-95 cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span className="text-[9px] tracking-tight">Salir</span>
      </button>
    </div>
  );
};
