'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/(protected)/layout';
import { signOut } from '@/lib/auth';
import { ROL_LABELS } from '@/lib/constants';

interface NavItemConfig {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  roles?: string[];
  exact?: boolean;
}

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close sheet on route change without triggering cascading render effect
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMenuOpen(false);
  }

  // Listen to open-mobile-menu event (e.g. from TopBar avatar click)
  useEffect(() => {
    const handleOpenMenu = () => setIsMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);

  // Handle ESC key to close sheet and trap scroll
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión de la aplicación?')) {
      await signOut();
      router.replace('/login');
    }
  };

  const isActive = useCallback(
    (href: string, exact = false) => {
      if (exact || href === '/dashboard' || href === '/tecnico') {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  if (!user) return null;

  // Secondary destinations accessible from the "Más" sheet
  const secondaryItems: { category: string; items: NavItemConfig[] }[] = [];

  // Group: Operaciones y Campo (for admin & operador)
  if (user.rol === 'admin' || user.rol === 'operador') {
    secondaryItems.push({
      category: 'Operaciones y Campo',
      items: [
        {
          href: '/equipos',
          label: 'Equipos y Activos',
          description: 'Registro técnico de maquinaria y ubicación',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          href: '/repuestos',
          label: 'Catálogo de Repuestos',
          description: 'Inventario maestro de piezas, códigos y precios',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
        {
          href: '/plantillas',
          label: 'Plantillas y Seguridad',
          description: 'Checklists de control, protocolos y tiempos estimados',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
        },
        {
          href: '/inventario/transferir',
          label: 'Kit Vehicular Stock',
          description: 'Transferencias de materiales y stock móvil',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          ),
        },
      ],
    });
  }

  // Group: Administración (for admin and superadmin)
  if (user.rol === 'admin' || user.rol === 'superadmin') {
    const adminItems: NavItemConfig[] = [];
    if (user.rol === 'superadmin') {
      adminItems.push({
        href: '/empresas',
        label: 'Empresas (Tenants)',
        description: 'Gestión global de empresas y licencias',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      });
    }
    adminItems.push({
      href: '/usuarios',
      label: 'Gestionar Usuarios',
      description: 'Cuentas de personal, roles y permisos de acceso',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    });

    secondaryItems.push({
      category: 'Administración',
      items: adminItems,
    });
  }

  // Check if current active route belongs to any secondary item
  const isSecondaryActive = secondaryItems.some((group) =>
    group.items.some((item) => isActive(item.href, item.exact))
  );

  return (
    <>
      {/* ── Bottom Navigation Bar ───────────────────────────────── */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/90 z-40 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)]"
      >
        <div className="max-w-lg mx-auto flex items-center justify-around h-[66px] px-2">
          {/* ROL: TÉCNICO */}
          {user.rol === 'tecnico' ? (
            <>
              {/* 1. Mis Órdenes */}
              <Link
                href="/tecnico"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/tecnico') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/tecnico')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Mis Órdenes</span>
              </Link>

              {/* 2. Kit Stock */}
              <Link
                href="/inventario/transferir"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/inventario/transferir') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/inventario/transferir')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Kit Stock</span>
              </Link>

              {/* 3. Menú / Perfil */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Abrir menú de usuario"
                className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-zinc-500 hover:text-zinc-900 transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <div className="p-1.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Perfil</span>
              </button>
            </>
          ) : user.rol === 'superadmin' ? (
            /* ROL: SUPERADMIN */
            <>
              {/* 1. Empresas */}
              <Link
                href="/empresas"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/empresas') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/empresas')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Empresas</span>
              </Link>

              {/* 2. Usuarios */}
              <Link
                href="/usuarios"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/usuarios') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/usuarios')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Usuarios</span>
              </Link>

              {/* 3. Menú / Perfil */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Abrir menú"
                className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-zinc-500 hover:text-zinc-900 transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <div className="p-1.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </div>
                <span className="text-[11px] tracking-tight font-medium">Menú</span>
              </button>
            </>
          ) : (
            /* ROL: ADMIN & OPERADOR (COORDINADOR) */
            <>
              {/* 1. Dashboard / Inicio */}
              <Link
                href="/dashboard"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/dashboard') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/dashboard')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                  </svg>
                </div>
                <span className="text-[10.5px] tracking-tight font-medium">Dashboard</span>
              </Link>

              {/* 2. Órdenes */}
              <Link
                href="/ordenes"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/ordenes') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/ordenes')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <span className="text-[10.5px] tracking-tight font-medium">Órdenes</span>
              </Link>

              {/* 3. BOTÓN ACCIÓN PRIMARIA CENTRAL: CREAR OT */}
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-[0_6px_18px_rgba(13,148,136,0.45)] ring-4 ring-white group-hover:scale-105 transition-all">
                  <svg className="w-6 h-6 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold tracking-tight text-teal-600 mt-0.5 group-hover:text-teal-700">
                  Crear OT
                </span>
              </button>

              {/* 4. Clientes */}
              <Link
                href="/clientes"
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                  isActive('/clientes') ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-300 ${
                    isActive('/clientes')
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-[10.5px] tracking-tight font-medium">Clientes</span>
              </Link>

              {/* 5. Más / Módulos Operativos (Trigger del Bottom Sheet) */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-expanded={isMenuOpen}
                aria-label="Abrir todas las opciones y módulos"
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 cursor-pointer ${
                  isSecondaryActive || isMenuOpen ? 'text-teal-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <div
                  className={`relative p-1.5 rounded-xl transition-all duration-300 ${
                    isSecondaryActive || isMenuOpen
                      ? 'bg-teal-50 text-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-1 ring-teal-200'
                      : ''
                  }`}
                >
                  {/* Icono de cuadrícula / menú de opciones */}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  {/* Badge de punto activo si el usuario navega en una subsección */}
                  {isSecondaryActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-600"></span>
                    </span>
                  )}
                </div>
                <span className="text-[10.5px] tracking-tight font-medium">Más</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Slide-up Bottom Sheet (Menú Completo de Navegación) ──────── */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop Blur con transición */}
          <div
            className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación y opciones"
            className="relative bg-white rounded-t-3xl shadow-2xl border-t border-zinc-200 z-10 w-full max-h-[85vh] flex flex-col overflow-hidden animate-slide-up pb-safe"
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center cursor-grab" onClick={() => setIsMenuOpen(false)}>
              <div className="w-12 h-1.5 bg-zinc-300 rounded-full" />
            </div>

            {/* Sheet Header: User Card & Close */}
            <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-700 to-teal-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {user.nombre
                    ? user.nombre
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 truncate">{user.nombre}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                      {ROL_LABELS[user.rol]}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 truncate">{user.email}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors shrink-0"
                aria-label="Cerrar menú"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sheet Scrollable Body: Categorized Destinations */}
            <div className="px-4 py-4 overflow-y-auto flex-1 flex flex-col gap-5">
              {/* Primary Views Quick Grid (For Admin & Operador) */}
              {(user.rol === 'admin' || user.rol === 'operador') && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2">
                    Vistas Principales
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all text-center active:scale-95 ${
                        isActive('/dashboard')
                          ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold shadow-xs'
                          : 'bg-zinc-50/80 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                      }`}
                    >
                      <svg className="w-4 h-4 mb-1 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                      </svg>
                      <span className="text-xs truncate w-full">Dashboard</span>
                    </Link>

                    <Link
                      href="/ordenes"
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all text-center active:scale-95 ${
                        isActive('/ordenes')
                          ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold shadow-xs'
                          : 'bg-zinc-50/80 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                      }`}
                    >
                      <svg className="w-4 h-4 mb-1 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span className="text-xs truncate w-full">Órdenes</span>
                    </Link>

                    <Link
                      href="/clientes"
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all text-center active:scale-95 ${
                        isActive('/clientes')
                          ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold shadow-xs'
                          : 'bg-zinc-50/80 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                      }`}
                    >
                      <svg className="w-4 h-4 mb-1 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-xs truncate w-full">Clientes</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Secondary Sections */}
              {secondaryItems.map((group) => (
                <div key={group.category} className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2">
                    {group.category}
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.items.map((item) => {
                      const itemActive = isActive(item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center gap-3.5 p-3 rounded-2xl transition-all duration-150 active:scale-[0.98] ${
                            itemActive
                              ? 'bg-teal-50/90 border border-teal-200 text-teal-900 font-semibold shadow-xs'
                              : 'bg-zinc-50/70 hover:bg-zinc-100/80 border border-zinc-200/60 text-zinc-700'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-xl shrink-0 transition-colors ${
                              itemActive
                                ? 'bg-teal-600 text-white shadow-xs shadow-teal-700/30'
                                : 'bg-white text-zinc-600 border border-zinc-200/80 shadow-2xs'
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold truncate leading-tight">
                                {item.label}
                              </span>
                              {itemActive && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white shrink-0">
                                  Activo
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-zinc-500 truncate mt-0.5 font-normal">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <svg
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              itemActive ? 'text-teal-600' : 'text-zinc-400'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Botón de Logout estilizado y seguro */}
              <div className="pt-2 border-t border-zinc-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-semibold text-red-600 bg-red-50/80 hover:bg-red-100 border border-red-200/70 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar Sesión de la Aplicación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
