'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { apiFetch } from '@/lib/api';
import { ROL_LABELS } from '@/lib/constants';
import { Empresa, Usuario, RolUsuario } from '@/types';

export default function EmpresaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Unwrap params using React.use()
  const unwrappedParams = use(params);
  const empresaId = Number(unwrappedParams.id);

  // States
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Empresa Modal states
  const [isEditEmpresaOpen, setIsEditEmpresaOpen] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editRuc, setEditRuc] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [editEmpresaLoading, setEditEmpresaLoading] = useState(false);
  const [editEmpresaError, setEditEmpresaError] = useState<string | null>(null);

  // User Modals state
  const [isCrearUserOpen, setIsCrearUserOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('tecnico');
  const [crearUserLoading, setCrearUserLoading] = useState(false);
  const [crearUserError, setCrearUserError] = useState<string | null>(null);

  // Edit User states
  const [selectedEditUser, setSelectedEditUser] = useState<Usuario | null>(null);
  const [editUserNombre, setEditUserNombre] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRol, setEditUserRol] = useState<RolUsuario>('tecnico');
  const [editUserActivo, setEditUserActivo] = useState(true);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  const fetchEmpresaAndUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empresaData, usuariosData] = await Promise.all([
        apiFetch<Empresa>(`/empresas/${empresaId}`),
        apiFetch<Usuario[]>('/usuarios'),
      ]);
      setEmpresa(empresaData);
      // Filter users belonging to this company
      setUsuarios(usuariosData.filter((u) => u.empresa_id === empresaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del tenant');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    // Role guard check
    if (user && user.rol !== 'superadmin') {
      router.replace('/dashboard');
      return;
    }

    if (empresaId) {
      Promise.resolve().then(() => {
        fetchEmpresaAndUsers();
      });
    }
  }, [user, router, empresaId, fetchEmpresaAndUsers]);

  // Edit Empresa handlers
  const openEditEmpresa = () => {
    if (!empresa) return;
    setEditNombre(empresa.nombre);
    setEditRuc(empresa.ruc);
    setEditApiKey(empresa.api_key);
    setEditActivo(empresa.activo);
    setEditEmpresaError(null);
    setIsEditEmpresaOpen(true);
  };

  const handleEditarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditEmpresaLoading(true);
    setEditEmpresaError(null);

    try {
      const updated = await apiFetch<Empresa>(`/empresas/${empresaId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: editNombre,
          ruc: editRuc,
          api_key: editApiKey,
          activo: editActivo,
        }),
      });
      setEmpresa(updated);
      setIsEditEmpresaOpen(false);
    } catch (err) {
      setEditEmpresaError(err instanceof Error ? err.message : 'Error al actualizar la empresa');
    } finally {
      setEditEmpresaLoading(false);
    }
  };

  const handleDesactivarEmpresa = async () => {
    if (!confirm('¿Está seguro de suspender temporalmente este tenant?')) return;
    try {
      const updated = await apiFetch<Empresa>(`/empresas/${empresaId}`, {
        method: 'DELETE',
      });
      setEmpresa(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al suspender la empresa');
    }
  };

  // User handlers
  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password || !rol) {
      setCrearUserError('Complete todos los campos obligatorios');
      return;
    }

    setCrearUserLoading(true);
    setCrearUserError(null);

    try {
      await apiFetch<Usuario>('/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol,
          activo: true,
          empresa_id: empresaId,
        }),
      });

      setNombre('');
      setEmail('');
      setPassword('');
      setRol('tecnico');
      setIsCrearUserOpen(false);
      fetchEmpresaAndUsers();
    } catch (err) {
      setCrearUserError(err instanceof Error ? err.message : 'Error al crear el usuario');
    } finally {
      setCrearUserLoading(false);
    }
  };

  const startEditUser = (usr: Usuario) => {
    setSelectedEditUser(usr);
    setEditUserNombre(usr.nombre);
    setEditUserEmail(usr.email);
    setEditUserPassword('');
    setEditUserRol(usr.rol);
    setEditUserActivo(usr.activo);
    setEditUserError(null);
  };

  const handleEditarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditUser) return;

    setEditUserLoading(true);
    setEditUserError(null);

    const payload: Record<string, string | number | boolean | null> = {
      nombre: editUserNombre,
      email: editUserEmail,
      rol: editUserRol,
      activo: editUserActivo,
      empresa_id: empresaId,
    };

    if (editUserPassword.trim()) {
      payload.password = editUserPassword;
    }

    try {
      await apiFetch<Usuario>(`/usuarios/${selectedEditUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSelectedEditUser(null);
      fetchEmpresaAndUsers();
    } catch (err) {
      setEditUserError(err instanceof Error ? err.message : 'Error al actualizar el usuario');
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleDesactivarUsuario = async (id: number) => {
    if (!confirm('¿Está seguro de suspender a este usuario?')) return;
    try {
      await apiFetch(`/usuarios/${id}`, {
        method: 'DELETE',
      });
      fetchEmpresaAndUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al suspender el usuario');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando ficha del tenant...</span>
      </div>
    );
  }

  if (error || !empresa) {
    return <ErrorMessage message={error || 'No se pudo cargar la empresa.'} retry={fetchEmpresaAndUsers} />;
  }

  const roleOptions = [
    { value: 'admin', label: 'Administrador de Empresa' },
    { value: 'operador', label: 'Operador de Empresa' },
    { value: 'tecnico', label: 'Técnico de Campo' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link
          href="/empresas"
          className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Empresas
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Company profile card */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                Ficha del Arrendatario
              </span>
              <h2 className="text-base font-bold text-zinc-950 mt-1">{empresa.nombre}</h2>
            </div>
            
            <div className="border-t border-zinc-100 pt-4 flex flex-col gap-3 text-xs">
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">RUC de Empresa</span>
                <span className="text-zinc-800 font-medium">{empresa.ruc}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Clave API de Ingesta</span>
                <code className="text-[10px] bg-zinc-50 border border-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-mono select-all block mt-1">
                  {empresa.api_key}
                </code>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Estado de Suscripción</span>
                <Badge
                  bg={empresa.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                  text={empresa.activo ? 'text-emerald-700' : 'text-zinc-500'}
                  border={empresa.activo ? 'border-emerald-200' : 'border-zinc-200'}
                  className="self-start mt-0.5"
                >
                  {empresa.activo ? 'Activo' : 'Suspendido'}
                </Badge>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={openEditEmpresa}>
                Editar Empresa
              </Button>
              {empresa.activo && (
                <Button size="sm" variant="danger" onClick={handleDesactivarEmpresa}>
                  Suspender
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Company users table list */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Personal Autorizado (Usuarios)</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Cuentas de usuario registradas en este tenant que operan el SaaS.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsCrearUserOpen(true)}>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Usuario
              </Button>
            </div>

            {usuarios.length === 0 ? (
              <EmptyState
                title="Sin Usuarios Asociados"
                description="Esta empresa aún no cuenta con operadores o técnicos registrados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-4">Nombre / Email</th>
                      <th className="py-2.5 px-4">Rol Operativo</th>
                      <th className="py-2.5 px-4">Estado</th>
                      <th className="py-2.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {usuarios.map((usr) => (
                      <tr key={usr.id} className="hover:bg-zinc-50/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-zinc-800 block text-[13px]">{usr.nombre}</span>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">{usr.email}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge bg="bg-zinc-100" text="text-zinc-800" border="border-zinc-200" className="uppercase tracking-wider text-[9px] font-bold">
                            {ROL_LABELS[usr.rol]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            bg={usr.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                            text={usr.activo ? 'text-emerald-700' : 'text-zinc-500'}
                            border={usr.activo ? 'border-emerald-200' : 'border-zinc-200'}
                          >
                            {usr.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="secondary" className="px-2.5 py-1 text-[10px]" onClick={() => startEditUser(usr)}>
                              Editar
                            </Button>
                            {usr.activo && (
                              <Button size="sm" variant="danger" className="px-2.5 py-1 text-[10px]" onClick={() => handleDesactivarUsuario(usr.id)}>
                                Suspender
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* Edit Empresa Modal */}
      {isEditEmpresaOpen && (
        <Modal
          isOpen={isEditEmpresaOpen}
          onClose={() => setIsEditEmpresaOpen(false)}
          title="Editar Datos de la Empresa"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsEditEmpresaOpen(false)} disabled={editEmpresaLoading}>
                Cancelar
              </Button>
              <Button onClick={handleEditarEmpresa} isLoading={editEmpresaLoading}>
                Guardar Cambios
              </Button>
            </>
          }
        >
          <form onSubmit={handleEditarEmpresa} className="flex flex-col gap-4">
            {editEmpresaError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {editEmpresaError}
              </div>
            )}

            <Input
              label="Nombre / Razón Social"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              required
            />

            <Input
              label="RUC de la Empresa"
              value={editRuc}
              onChange={(e) => setEditRuc(e.target.value)}
              required
              maxLength={20}
            />

            <Input
              label="Clave API de Ingesta"
              value={editApiKey}
              onChange={(e) => setEditApiKey(e.target.value)}
              required
            />

            <div className="flex items-center gap-2 mt-2">
              <input
                id="edit-empresa-activo-cb"
                type="checkbox"
                checked={editActivo}
                onChange={(e) => setEditActivo(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-zinc-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="edit-empresa-activo-cb" className="text-xs font-medium text-zinc-650">
                Tenant Activo / Habilitar servicio web
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Crear User Modal */}
      {isCrearUserOpen && (
        <Modal
          isOpen={isCrearUserOpen}
          onClose={() => setIsCrearUserOpen(false)}
          title="Registrar Usuario para la Empresa"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsCrearUserOpen(false)} disabled={crearUserLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCrearUsuario} isLoading={crearUserLoading}>
                Registrar Usuario
              </Button>
            </>
          }
        >
          <form onSubmit={handleCrearUsuario} className="flex flex-col gap-4">
            {crearUserError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearUserError}
              </div>
            )}

            <Input
              label="Nombre Completo (Requerido)"
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />

            <Input
              label="Correo electrónico (Requerido)"
              type="email"
              placeholder="juan@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Contraseña Temporal (Requerido, Min 8 caracteres)"
              type="password"
              placeholder="Min 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Select
              label="Rol Operativo en la Empresa"
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              options={roleOptions}
            />
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {selectedEditUser && (
        <Modal
          isOpen={!!selectedEditUser}
          onClose={() => setSelectedEditUser(null)}
          title={`Editar Usuario: ${selectedEditUser.nombre}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelectedEditUser(null)} disabled={editUserLoading}>
                Cancelar
              </Button>
              <Button onClick={handleEditarUsuario} isLoading={editUserLoading}>
                Guardar Cambios
              </Button>
            </>
          }
        >
          <form onSubmit={handleEditarUsuario} className="flex flex-col gap-4">
            {editUserError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {editUserError}
              </div>
            )}

            <Input
              label="Nombre Completo"
              value={editUserNombre}
              onChange={(e) => setEditUserNombre(e.target.value)}
              required
            />

            <Input
              label="Correo electrónico"
              type="email"
              value={editUserEmail}
              onChange={(e) => setEditUserEmail(e.target.value)}
              required
            />

            <Input
              label="Cambiar Contraseña (Opcional, Dejar en blanco para mantener actual)"
              type="password"
              placeholder="Min 8 caracteres"
              value={editUserPassword}
              onChange={(e) => setEditUserPassword(e.target.value)}
            />

            <Select
              label="Rol Operativo"
              value={editUserRol}
              onChange={(e) => setEditUserRol(e.target.value as RolUsuario)}
              options={roleOptions}
            />

            <div className="flex items-center gap-2 mt-2">
              <input
                id="edit-user-activo-cb"
                type="checkbox"
                checked={editUserActivo}
                onChange={(e) => setEditUserActivo(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-zinc-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="edit-user-activo-cb" className="text-xs font-medium text-zinc-650">
                Usuario Activo / Permiso de acceso
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
