import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, empresa_id')
    .eq('rol', 'tecnico')
    .eq('activo', true)
    .order('nombre')

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
