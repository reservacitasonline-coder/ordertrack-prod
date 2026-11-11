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
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(nombre), tecnico:usuarios(nombre)')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
