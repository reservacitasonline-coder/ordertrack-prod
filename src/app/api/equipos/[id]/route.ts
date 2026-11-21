import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const EQUIPO_SELECT = '*, tipo:equipo_tipos(id,nombre,categoria:equipo_categorias(id,nombre)), cliente:clientes(id,nombre)'

function mapEquipoRow(row: Record<string, unknown>) {
  const attrs = (row.atributos as Record<string, unknown> | null) ?? {}
  return {
    ...row,
    numero_serie: (attrs.numero_serie as string | null) ?? (row.codigo_inventario as string | null) ?? null,
    modelo: (attrs.modelo as string | null) ?? null,
    marca: (attrs.marca as string | null) ?? null,
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  let query = supabase.from('equipos').select(EQUIPO_SELECT).eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data, error } = await query.single()
  if (error || !data) return errorResponse('Equipo no encontrado', 404)
  return Response.json(mapEquipoRow(data as Record<string, unknown>))
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
  const numeroSerie = body.numero_serie !== undefined ? (body.numero_serie ? String(body.numero_serie).trim() : null) : undefined
  const updateData: Record<string, unknown> = {}
  if (body.nombre !== undefined) updateData.nombre = body.nombre
  if (body.cliente_id !== undefined) updateData.cliente_id = Number(body.cliente_id)
  if (body.tipo_id !== undefined) updateData.tipo_id = Number(body.tipo_id)
  if (body.codigo_inventario !== undefined || numeroSerie !== undefined) {
    updateData.codigo_inventario = (body.codigo_inventario ? String(body.codigo_inventario).trim() : numeroSerie) || null
  }
  if (body.area !== undefined) updateData.area = body.area
  if (body.ubicacion_detalle !== undefined) updateData.ubicacion_detalle = body.ubicacion_detalle
  if (body.estado_operativo !== undefined) updateData.estado_operativo = body.estado_operativo
  if (body.activo !== undefined) updateData.activo = body.activo
  if (body.numero_serie !== undefined || body.modelo !== undefined || body.marca !== undefined || body.atributos !== undefined) {
    updateData.atributos = {
      ...(body.atributos ?? {}),
      numero_serie: numeroSerie ?? null,
      modelo: body.modelo ? String(body.modelo).trim() : null,
      marca: body.marca ? String(body.marca).trim() : null,
    }
  }

  let query = supabase.from('equipos').update(updateData).eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data, error } = await query.select(EQUIPO_SELECT).single()
  if (error || !data) return errorResponse(error?.message || 'Equipo no encontrado', 404)
  return Response.json(mapEquipoRow(data as Record<string, unknown>))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  let query = supabase.from('equipos').update({ activo: false }).eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { error } = await query
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
