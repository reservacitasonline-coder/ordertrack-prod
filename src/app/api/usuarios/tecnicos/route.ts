import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(request: Request) {
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

  if (user!.rol !== 'superadmin') {
    if (user!.empresa_id) query = query.eq('empresa_id', user!.empresa_id)
  } else {
    // El superadmin no tiene empresa propia: se filtra por la empresa de la orden o del cliente
    const pedida = Number(new URL(request.url).searchParams.get('empresa_id'))
    if (Number.isInteger(pedida) && pedida > 0) query = query.eq('empresa_id', pedida)
  }

  const { data, error } = await query

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
