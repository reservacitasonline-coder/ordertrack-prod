import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ tecnico_id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  // Técnico solo puede ver su propio inventario; admin/superadmin pueden ver cualquiera
  const { tecnico_id } = await params
  if (user!.rol === 'tecnico' && user!.id !== parseInt(tecnico_id)) {
    return Response.json({ detail: 'Sin permisos para esta acción' }, { status: 403 })
  }
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador', 'tecnico'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('inventario_tecnicos')
    .select('*, material:repuestos_materiales(id, nombre, codigo, unidad_medida)')
    .eq('tecnico_id', tecnico_id)
    .order('id')

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
