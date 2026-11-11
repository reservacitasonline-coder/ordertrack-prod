import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const categoriaId = searchParams.get('categoria_id')

  const supabase = createServiceClient()
  let query = supabase
    .from('equipo_tipos')
    .select('*, categoria:equipo_categorias(id,nombre)')
    .order('nombre')
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  if (categoriaId) query = query.eq('categoria_id', categoriaId)

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
  if (!body.categoria_id) return errorResponse('categoria_id requerido', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('equipo_tipos')
    .insert({ ...body, empresa_id })
    .select('*, categoria:equipo_categorias(id,nombre)')
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
