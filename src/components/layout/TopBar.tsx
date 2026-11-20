'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/(protected)/layout';
import { apiFetch } from '@/lib/api';
import { ROL_LABELS } from '@/lib/constants';
import type { Empresa } from '@/types';

export const TopBar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.empresa_id) return;
    let active = true;
    apiFetch<Empresa>(`/empresas/${user.empresa_id}`)
      .then((emp) => {
        if (active && emp?.nombre) setEmpresaNombre(emp.nombre);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.empresa_id]);

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

      {/* Enterprise/Tenant context */}
      {user && (
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              window.dispatchEvent(new Event('open-mobile-menu'));
            }
          }}
          className="flex items-center gap-3 text-left focus:outline-none cursor-pointer md:cursor-default"
          title={user.nombre ? `${user.nombre} (${ROL_LABELS[user.rol] || user.rol})` : 'Usuario'}
        >
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-zinc-950">
              {user.rol === 'superadmin' ? 'Superadmin Global' : empresaNombre || 'Mi empresa'}
            </span>
            {user.rol === 'superadmin' && (
              <span className="text-[10px] text-zinc-500 font-medium">Panel de Control SaaS</span>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-xs uppercase shadow-2xs">
            {user.rol === 'superadmin'
              ? 'SA'
              : (empresaNombre || 'EA')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)}
          </div>
        </button>
      )}
    </header>
  );
};
