import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '../../_lib/auth'

export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const prioridad = searchParams.get('prioridad')
  const q = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = Math.min(parseInt(searchParams.get('page_size') || '20'), 100)

  const supabase = createServiceClient()
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(id,nombre,telefono,direccion), canal:canal_ingreso(id,nombre), plantilla:plantillas_trabajo(id,titulo,plantilla_items(*))')
    .eq('tecnico_asignado_id', user!.id)
    .order('id', { ascending: false })
    .range((page - 1) * page_size, page * page_size - 1)

  if (user!.empresa_id) query = query.eq('empresa_id', user!.empresa_id)
  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (q) query = query.or(`titulo.ilike.%${q}%,codigo_interno.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
