'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
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
import { Usuario, Empresa, RolUsuario } from '@/types';

export default function UsuariosPage() {
  const router = useRouter();
  const { user } = useAuth();

  // States
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCrearOpen, setIsCrearOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('tecnico');
  const [targetEmpresaId, setTargetEmpresaId] = useState('');
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  // Edit states
  const [selectedEdit, setSelectedEdit] = useState<Usuario | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol, setEditRol] = useState<RolUsuario>('tecnico');
  const [editTargetEmpresaId, setEditTargetEmpresaId] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUsersAndTenants = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const promises: [Promise<Usuario[]>, Promise<Empresa[] | null>] = [
        apiFetch<Usuario[]>('/usuarios'),
        user.rol === 'superadmin' ? apiFetch<Empresa[]>('/empresas') : Promise.resolve(null),
      ];

      const [usuariosData, empresasData] = await Promise.all(promises);
      setUsuarios(usuariosData);
      if (empresasData) setEmpresas(empresasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (user.rol !== 'admin' && user.rol !== 'superadmin') {
        router.replace('/dashboard');
        return;
      }
    }

    Promise.resolve().then(() => {
      fetchUsersAndTenants();
    });
  }, [user, router, fetchUsersAndTenants]);

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password || !rol) {
      setCrearError('Nombre, correo, contraseña y rol son obligatorios');
      return;
    }

    setCrearLoading(true);
    setCrearError(null);

    // Build payload
    const payload: Record<string, string | number | boolean | null> = {
      nombre,
      email,
      password,
      rol,
      activo: true,
      empresa_id: user?.rol === 'superadmin' 
        ? (rol === 'superadmin' ? null : (targetEmpresaId ? Number(targetEmpresaId) : null))
        : (user?.empresa_id ?? null),
    };

    try {
      await apiFetch<Usuario>('/usuarios', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setNombre('');
      setEmail('');
      setPassword('');
      setRol('tecnico');
      setTargetEmpresaId('');
      setIsCrearOpen(false);
      fetchUsersAndTenants();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al registrar el usuario');
    } finally {
      setCrearLoading(false);
    }
  };

  const handleEditarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdit) return;

    setEditLoading(true);
    setEditError(null);

    // Build patch payload
    const payload: Record<string, string | number | boolean | null> = {
      nombre: editNombre,
      email: editEmail,
      rol: editRol,
      activo: editActivo,
      empresa_id: user?.rol === 'superadmin' 
        ? (editRol === 'superadmin' ? null : (editTargetEmpresaId ? Number(editTargetEmpresaId) : null))
        : (user?.empresa_id ?? null),
    };

    if (editPassword.trim()) {
      payload.password = editPassword;
    }

    try {
      await apiFetch<Usuario>(`/usuarios/${selectedEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSelectedEdit(null);
      fetchUsersAndTenants();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar el usuario');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDesactivarUsuario = async (id: number) => {
    if (!confirm('¿Está seguro de suspender temporalmente este usuario?')) return;
    try {
      await apiFetch(`/usuarios/${id}`, {
        method: 'DELETE',
      });
      fetchUsersAndTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desactivar el usuario');
    }
  };

  const startEdit = (usr: Usuario) => {
    setSelectedEdit(usr);
    setEditNombre(usr.nombre);
    setEditEmail(usr.email);
    setEditPassword('');
    setEditRol(usr.rol);
    setEditTargetEmpresaId(usr.empresa_id ? String(usr.empresa_id) : '');
    setEditActivo(usr.activo);
    setEditError(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando directorio de usuarios...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchUsersAndTenants} />;
  }

  // Agrupados por tipo (mayor a menor jerarquía) y, dentro de cada tipo, por nombre
  const ORDEN_ROL: Record<string, number> = { superadmin: 0, admin: 1, operador: 2, tecnico: 3 };
  const usuariosOrdenados = [...usuarios].sort(
    (a, b) => (ORDEN_ROL[a.rol] ?? 9) - (ORDEN_ROL[b.rol] ?? 9) || a.nombre.localeCompare(b.nombre, 'es')
  );

  // Filter rol options based on logged-in user role
  const rolOptions = user?.rol === 'superadmin' 
    ? [
        { value: 'superadmin', label: 'Superadmin' },
        { value: 'admin', label: 'Administrador de Empresa' },
        { value: 'operador', label: 'Operador de Empresa' },
        { value: 'tecnico', label: 'Técnico de Campo' },
      ]
    : [
        { value: 'admin', label: 'Administrador' },
        { value: 'operador', label: 'Operador' },
        { value: 'tecnico', label: 'Técnico' },
      ];

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Action Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Directorio de Usuarios</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {user?.rol === 'superadmin' 
              ? 'Gestione las cuentas globales de operadores, técnicos y administradores de la plataforma.'
              : 'Gestione las cuentas y perfiles de técnicos y operadores en su empresa.'}
          </p>
        </div>
        <Button onClick={() => setIsCrearOpen(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </Button>
      </div>

      {/* Grid listing */}
      {usuarios.length === 0 ? (
        <EmptyState
          title="Sin Usuarios Registrados"
          description="Aún no se han registrado cuentas en este directorio."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {usuariosOrdenados.map((usr) => (
            <Card key={usr.id} className="flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 leading-tight truncate" title={usr.nombre}>
                    {usr.nombre}
                  </h3>
                  <Badge
                    bg={usr.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                    text={usr.activo ? 'text-emerald-700' : 'text-zinc-500'}
                    border={usr.activo ? 'border-emerald-200' : 'border-zinc-200'}
                  >
                    {usr.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">{usr.email}</span>

                <div className="mt-3 flex flex-col gap-1.5">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold block mb-0.5">Rol en Sistema:</span>
                    <Badge bg="bg-zinc-100" text="text-zinc-800" border="border-zinc-200" className="uppercase tracking-wider text-[9px] font-bold">
                      {ROL_LABELS[usr.rol]}
                    </Badge>
                  </div>
                  {user?.rol === 'superadmin' && (
                    <div>
                      <span className="text-[10px] text-zinc-400 font-semibold block mb-0.5">Empresa Tenant:</span>
                      <span className="text-xs text-zinc-700 font-medium">
                        {usr.empresa_id === null
                          ? 'SaaS Platform Owner'
                          : empresas.find((e) => e.id === usr.empresa_id)?.nombre || `Tenant ID: ${usr.empresa_id}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-3.5 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => startEdit(usr)}>
                  Editar
                </Button>
                {usr.activo && usr.id !== user?.id && (
                  <Button size="sm" variant="danger" onClick={() => handleDesactivarUsuario(usr.id)}>
                    Suspender
                  </Button>
                )}
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
          title="Agregar Nuevo Usuario"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsCrearOpen(false)} disabled={crearLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCrearUsuario} isLoading={crearLoading}>
                Registrar Usuario
              </Button>
            </>
          }
        >
          <form onSubmit={handleCrearUsuario} className="flex flex-col gap-4">
            {crearError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearError}
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
              placeholder="juan@ordertrack.com"
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
              label="Rol en el Sistema (Requerido)"
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              options={rolOptions}
            />

            {user?.rol === 'superadmin' && rol !== 'superadmin' && (
              <Select
                label="Asociar a Empresa (Requerido)"
                placeholder="Seleccione empresa..."
                value={targetEmpresaId}
                onChange={(e) => setTargetEmpresaId(e.target.value)}
                options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
              />
            )}
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {selectedEdit && (
        <Modal
          isOpen={!!selectedEdit}
          onClose={() => setSelectedEdit(null)}
          title={`Editar Usuario: ${selectedEdit.nombre}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelectedEdit(null)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button onClick={handleEditarUsuario} isLoading={editLoading}>
                Guardar Cambios
              </Button>
            </>
          }
        >
          <form onSubmit={handleEditarUsuario} className="flex flex-col gap-4">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {editError}
              </div>
            )}

            <Input
              label="Nombre Completo"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              required
            />

            <Input
              label="Correo electrónico"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
            />

            <Input
              label="Cambiar Contraseña (Opcional, Dejar en blanco para mantener actual)"
              type="password"
              placeholder="Contraseña nueva (Min 8)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />

            <Select
              label="Rol en el Sistema"
              value={editRol}
              onChange={(e) => setEditRol(e.target.value as RolUsuario)}
              options={rolOptions}
            />

            {user?.rol === 'superadmin' && editRol !== 'superadmin' && (
              <Select
                label="Asociar a Empresa"
                placeholder="Seleccione empresa..."
                value={editTargetEmpresaId}
                onChange={(e) => setEditTargetEmpresaId(e.target.value)}
                options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
              />
            )}

            {selectedEdit.id !== user?.id && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="edit-activo-cb"
                  type="checkbox"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-zinc-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="edit-activo-cb" className="text-xs font-medium text-zinc-600">
                  Usuario Activo / Permiso de Acceso
                </label>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
