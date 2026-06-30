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
import { Cliente } from '@/types';

export default function ClientesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.rol === 'superadmin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Modal registration state
  const [isOpen, setIsOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Cliente[]>('/clientes');
      setClientes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchClientes();
    });
  }, [fetchClientes]);

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !ruc) {
      setCrearError('Nombre y RUC son campos obligatorios');
      return;
    }

    setCrearLoading(true);
    setCrearError(null);

    try {
      await apiFetch<Cliente>('/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          ruc,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          activo: true,
        }),
      });

      // Reset form
      setNombre('');
      setRuc('');
      setEmail('');
      setTelefono('');
      setIsOpen(false);

      // Refresh list
      fetchClientes();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al registrar cliente');
    } finally {
      setCrearLoading(false);
    }
  };

  const isAdmin = user?.rol === 'admin' || user?.rol === 'superadmin';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando catálogo de clientes...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchClientes} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Action Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Clientes & Contratos</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Clientes que envían OTs y sus respectivas matrices de equivalencias de prioridad.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsOpen(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </Button>
        )}
      </div>

      {/* Grid listing */}
      {clientes.length === 0 ? (
        <EmptyState
          title="Sin Clientes Registrados"
          description="Aún no se han registrado clientes para su empresa contratista."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clientes.map((c) => (
            <Card key={c.id} className="flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 leading-tight truncate" title={c.nombre}>
                    {c.nombre}
                  </h3>
                  <Badge
                    bg={c.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                    text={c.activo ? 'text-emerald-700' : 'text-zinc-500'}
                    border={c.activo ? 'border-emerald-200' : 'border-zinc-200'}
                    className="shrink-0"
                  >
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">RUC: {c.ruc}</span>

                <div className="flex flex-col gap-1 mt-2 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{c.email || 'Sin correo registrado'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{c.telefono || 'Sin teléfono registrado'}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-3 flex justify-end">
                <Link
                  href={`/clientes/${c.id}`}
                  className="text-xs text-teal-600 hover:text-teal-700 font-bold border border-teal-100 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  Configurar Equivalencias
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Agregar Nuevo Cliente"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={crearLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCrearCliente} isLoading={crearLoading}>
                Guardar Cliente
              </Button>
            </>
          }
        >
          <form onSubmit={handleCrearCliente} className="flex flex-col gap-4">
            {crearError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearError}
              </div>
            )}

            <Input
              label="Nombre del Cliente / Razón Social (Requerido)"
              placeholder="Ej: Banco de la Nación"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />

            <Input
              label="RUC del Cliente (Requerido)"
              placeholder="Ej: 20123456789"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              required
              maxLength={20}
            />

            <Input
              label="Correo de Contacto"
              type="email"
              placeholder="contacto@cliente.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Teléfono de Contacto"
              placeholder="Ej: +51 999 888 777"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
