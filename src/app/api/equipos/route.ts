import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const EQUIPO_SELECT = '*, tipo:equipo_tipos(id,nombre,categoria:equipo_categorias(id,nombre)), cliente:clientes(id,nombre)'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('cliente_id')
  const tipoId = searchParams.get('tipo_id')

  const supabase = createServiceClient()
  let query = supabase.from('equipos').select(EQUIPO_SELECT).eq('activo', true).order('nombre')
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (tipoId) query = query.eq('tipo_id', tipoId)

  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const body = await request.json()
  const empresa_id = user!.rol === 'superadmin' ? (body.empresa_id ?? user!.empresa_id) : user!.empresa_id
  if (!empresa_id) return errorResponse('empresa_id requerido', 400)
  if (!body.cliente_id) return errorResponse('cliente_id requerido', 400)
  if (!body.tipo_id) return errorResponse('tipo_id requerido', 400)
  if (!body.nombre) return errorResponse('nombre requerido', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('equipos')
    .insert({ ...body, empresa_id })
    .select(EQUIPO_SELECT)
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
