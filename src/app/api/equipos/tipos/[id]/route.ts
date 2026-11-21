import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  let query = supabase
    .from('equipo_tipos')
    .select('*, categoria:equipo_categorias(id,nombre)')
    .eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data, error } = await query.single()
  if (error || !data) return errorResponse('Tipo no encontrado', 404)
  return Response.json({
    ...data,
    descripcion: (data.campos_sugeridos as { descripcion?: string } | null)?.descripcion ?? null,
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()
  const updateData: Record<string, unknown> = {}
  if (body.nombre !== undefined) updateData.nombre = body.nombre
  if (body.categoria_id !== undefined) updateData.categoria_id = Number(body.categoria_id)
  if (body.campos_sugeridos !== undefined || body.descripcion !== undefined) {
    updateData.campos_sugeridos = body.campos_sugeridos ?? (body.descripcion ? { descripcion: body.descripcion } : null)
  }
  if (body.activo !== undefined) updateData.activo = body.activo

  let query = supabase.from('equipo_tipos').update(updateData).eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data, error } = await query.select('*, categoria:equipo_categorias(id,nombre)').single()
  if (error || !data) return errorResponse(error?.message || 'Tipo no encontrado', 404)
  return Response.json({
    ...data,
    descripcion: (data.campos_sugeridos as { descripcion?: string } | null)?.descripcion ?? null,
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  let query = supabase.from('equipo_tipos').update({ activo: false }).eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { error } = await query
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
