import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const EQUIPO_SELECT = '*, tipo:equipo_tipos(id,nombre,categoria:equipo_categorias(id,nombre)), cliente:clientes(id,nombre)'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('equipos').select(EQUIPO_SELECT).eq('id', id).single()
  if (error) return errorResponse(error.message, 404)
  return Response.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('equipos').update(body).eq('id', id).select(EQUIPO_SELECT).single()
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { error } = await supabase.from('equipos').update({ activo: false }).eq('id', id)
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
