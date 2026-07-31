'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarLink } from './SidebarLink';
import { getUserFromToken, removeTokens } from '@/lib/auth';
import { ROL_LABELS } from '@/lib/constants';
import { UsuarioResumen } from '@/types';

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UsuarioResumen | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setUser(getUserFromToken());
    });
  }, []);

  const handleLogout = () => {
    removeTokens();
    router.replace('/login');
  };

  return (
    <aside className="w-64 bg-zinc-950 text-zinc-100 flex flex-col h-screen shrink-0 border-r border-zinc-900">
      {/* Brand Logo */}
      <div className="h-16 px-6 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-teal-900/40">
            O
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-white">OrderTrack</span>
            <span className="text-[10px] text-teal-500 font-medium tracking-wider uppercase">SaaS Operations</span>
          </div>
        </div>
      </div>

      {/* Quick Action Button */}
      {user?.rol !== 'tecnico' && (
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => {
              if (pathname === '/ordenes') {
                window.dispatchEvent(new Event('open-crear-ot'));
              } else {
                router.push('/ordenes?crear=true');
                setTimeout(() => {
                  window.dispatchEvent(new Event('open-crear-ot'));
                }, 120);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/50 transition-all active:scale-95 border border-teal-500/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Crear OT
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5">
        <SidebarLink
          href="/dashboard"
          label="Dashboard"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
            </svg>
          }
        />

        {user?.rol === 'superadmin' ? (
          <>
            <SidebarLink
              href="/empresas"
              label="Empresas (Tenants)"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
          </>
        ) : (
          <>
            <SidebarLink
              href="/ordenes"
              label="Órdenes de Trabajo"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
            />
            {(user?.rol === 'admin' || user?.rol === 'operador') && (
              <>
                <SidebarLink
                  href="/clientes"
                  label="Clientes y Contratos"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                />
                <SidebarLink
                  href="/plantillas"
                  label="Plantillas y Seguridad"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  }
                />
                <SidebarLink
                  href="/repuestos"
                  label="Catálogo Repuestos"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  }
                />
              </>
            )}
            <SidebarLink
              href="/inventario/transferir"
              label="Kit Vehicular Stock"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              }
            />
            {user?.rol === 'admin' && (
              <SidebarLink
                href="/usuarios"
                label="Gestionar Usuarios"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
              />
            )}
          </>
        )}
      </nav>

      {/* User profile & Logout */}
      <div className="p-4 border-t border-zinc-900 flex flex-col gap-3">
        {user && (
          <div className="flex flex-col px-2 gap-1">
            <span className="text-xs font-semibold text-white truncate">{user.nombre}</span>
            <span className="text-[10px] text-zinc-500 truncate mb-1">{user.email}</span>
            <span className="inline-flex self-start px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
              {ROL_LABELS[user.rol]}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-red-950/20 hover:border-red-900/30 border border-transparent transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};
