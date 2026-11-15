'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { apiFetch } from '@/lib/api';
import { Empresa } from '@/types';

export default function EmpresasPage() {
  const router = useRouter();
  const { user } = useAuth();

  // States
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCrearOpen, setIsCrearOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Empresa[]>('/empresas');
      setEmpresas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Role guard check
    if (user && user.rol !== 'superadmin') {
      router.replace('/dashboard');
      return;
    }

    Promise.resolve().then(() => {
      fetchEmpresas();
    });
  }, [user, router, fetchEmpresas]);

  const handleCrearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !ruc) {
      setCrearError('Nombre y RUC son campos obligatorios');
      return;
    }

    setCrearLoading(true);
    setCrearError(null);

    try {
      await apiFetch<Empresa>('/empresas', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          ruc,
          api_key: apiKey.trim() || undefined,
          activo: true,
        }),
      });

      setNombre('');
      setRuc('');
      setApiKey('');
      setIsCrearOpen(false);
      fetchEmpresas();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al registrar la empresa');
    } finally {
      setCrearLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando empresas registradas...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchEmpresas} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Action Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Empresas (Tenants)</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Administración centralizada de las empresas que arrendan el software.
          </p>
        </div>
        <Button onClick={() => setIsCrearOpen(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Empresa
        </Button>
      </div>

      {/* Grid listing */}
      {empresas.length === 0 ? (
        <EmptyState
          title="Sin Empresas Registradas"
          description="Aún no se han registrado empresas arrendatarias en la plataforma SaaS."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {empresas.map((emp) => (
            <Card key={emp.id} className="flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 leading-tight truncate" title={emp.nombre}>
                    {emp.nombre}
                  </h3>
                  <Badge
                    bg={emp.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                    text={emp.activo ? 'text-emerald-700' : 'text-zinc-500'}
                    border={emp.activo ? 'border-emerald-200' : 'border-zinc-200'}
                  >
                    {emp.activo ? 'Activo' : 'Suspendido'}
                  </Badge>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">RUC: {emp.ruc}</span>

                {/* Clave API oculta en v1.0 (sin endpoint de ingesta). */}
              </div>

              <div className="border-t border-zinc-100 pt-3.5 flex justify-end">
                <Link
                  href={`/empresas/${emp.id}`}
                  className="text-xs text-teal-600 hover:text-teal-700 font-bold border border-teal-100 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  Ver Ficha y Usuarios
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {isCrearOpen && (
        <Modal
          isOpen={isCrearOpen}
          onClose={() => setIsCrearOpen(false)}
          title="Registrar Nueva Empresa (Tenant)"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsCrearOpen(false)} disabled={crearLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCrearEmpresa} isLoading={crearLoading}>
                Registrar Tenant
              </Button>
            </>
          }
        >
          <form onSubmit={handleCrearEmpresa} className="flex flex-col gap-4">
            {crearError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearError}
              </div>
            )}

            <Input
              label="Nombre / Razón Social (Requerido)"
              placeholder="Ej: Contratistas Industriales S.A.C."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />

            <Input
              label="RUC de la Empresa (Requerido)"
              placeholder="Ej: 20987654321"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              required
              maxLength={20}
            />

          </form>
        </Modal>
      )}
    </div>
  );
}
