import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(id, nombre, ruc), tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre, email)')
    .order('created_at', { ascending: false })
    .limit(10)

  if (user!.rol !== 'superadmin') {
    if (!user!.empresa_id) return errorResponse('Usuario sin empresa asignada', 403)
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
