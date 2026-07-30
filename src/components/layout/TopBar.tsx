'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserFromToken } from '@/lib/auth';
import { UsuarioResumen } from '@/types';

export const TopBar: React.FC = () => {
  const pathname = usePathname();
  const [user, setUser] = useState<UsuarioResumen | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setUser(getUserFromToken());
    });
  }, []);

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Inicio';
    
    return segments
      .map((segment) => {
        if (segment === 'dashboard') return 'Dashboard';
        if (segment === 'ordenes') return 'Órdenes de Trabajo';
        if (segment === 'clientes') return 'Clientes';
        // Handle sub-pages
        if (!isNaN(Number(segment))) return `Detalle #${segment}`;
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join(' / ');
  };

  return (
    <header className="h-16 bg-white border-b border-zinc-200/80 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
      {/* Breadcrumb / Section Title */}
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 min-w-0 pr-2">
        <span className="text-zinc-800 truncate">{getBreadcrumb()}</span>
      </div>

      {/* Enterprise/Tenant context & Action */}
      {user && (
        <div className="flex items-center gap-3">
          {user.rol !== 'tecnico' && (
            <Link
              href="/ordenes?crear=true"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-95 mr-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Crear OT
            </Link>
          )}

          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-zinc-950">
              {user.rol === 'superadmin' ? 'Superadmin Global' : 'Empresa Activa'}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              {user.rol === 'superadmin' 
                ? 'Panel de Control SaaS' 
                : user.empresa_id === 1 
                  ? 'Empresa Alpha S.A.C.' 
                  : user.empresa_id === 2 
                    ? 'Empresa Beta SRL' 
                    : `Tenant ID: ${user.empresa_id || 'Global'}`
              }
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-xs uppercase shadow-2xs">
            {user.rol === 'superadmin' ? 'SA' : user.empresa_id === 1 ? 'EA' : 'EB'}
          </div>
        </div>
      )}
    </header>
  );
};
