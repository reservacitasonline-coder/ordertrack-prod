import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { COLUMNA_AUTOTRANSFERENCIA, esColumnaInexistente, leerEmpresaConfig } from '../../../_lib/empresa-config'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

// Configuración operativa de la empresa. La lee cualquier usuario de la empresa
// (el técnico la necesita para saber qué puede hacer); solo el admin la cambia.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isInteger(empresaId) || empresaId <= 0) return errorResponse('Empresa inválida', 400)
  if (user!.rol !== 'superadmin' && user!.empresa_id !== empresaId) {
    return errorResponse('Sin permisos para esta acción', 403)
  }

  const config = await leerEmpresaConfig(createServiceClient(), empresaId)
  if (!config) return errorResponse('Empresa no encontrada', 404)
  return Response.json(config)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const empresaId = Number(id)
  if (!Number.isInteger(empresaId) || empresaId <= 0) return errorResponse('Empresa inválida', 400)
  if (user!.rol !== 'superadmin' && user!.empresa_id !== empresaId) {
    return errorResponse('Sin permisos para esta acción', 403)
  }

  const body = (await request.json()) as Record<string, unknown>
  if (typeof body.tecnico_autotransferencia !== 'boolean') {
    return errorResponse('tecnico_autotransferencia debe ser true o false', 400)
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('empresas')
    .update({ [COLUMNA_AUTOTRANSFERENCIA]: body.tecnico_autotransferencia })
    .eq('id', empresaId)

  if (error) {
    if (esColumnaInexistente(error)) {
      return errorResponse(
        'Falta aplicar la migración supabase/migrations/20261115_config_autotransferencia.sql en la base de datos',
        409
      )
    }
    return errorResponse(error.message)
  }

  const config = await leerEmpresaConfig(supabase, empresaId)
  return Response.json(config)
}

export const PATCH = PUT
