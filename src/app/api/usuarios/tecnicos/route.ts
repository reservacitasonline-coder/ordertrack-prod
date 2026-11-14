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
    .from('usuarios')
    .select('id, nombre, email, empresa_id, rol')
    .eq('rol', 'tecnico')
    .eq('activo', true)
    .order('nombre')

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
