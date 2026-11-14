import { createServiceClient, errorResponse } from '../_lib/supabase-server'
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
  return Response.json((data ?? []).map((r) => mapEquipoRow(r as Record<string, unknown>)))
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

  const numeroSerie = body.numero_serie ? String(body.numero_serie).trim() : null
  const codigoInventario = body.codigo_inventario ? String(body.codigo_inventario).trim() : numeroSerie

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('equipos')
    .insert({
      empresa_id,
      cliente_id: Number(body.cliente_id),
      tipo_id: Number(body.tipo_id),
      nombre: body.nombre,
      codigo_inventario: codigoInventario || null,
      area: body.area ?? null,
      ubicacion_detalle: body.ubicacion_detalle ?? null,
      atributos: {
        ...(body.atributos ?? {}),
        numero_serie: numeroSerie,
        modelo: body.modelo ? String(body.modelo).trim() : null,
        marca: body.marca ? String(body.marca).trim() : null,
      },
      estado_operativo: body.estado_operativo ?? 'OPERATIVO',
      activo: body.activo ?? true,
    })
    .select(EQUIPO_SELECT)
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(mapEquipoRow(data as Record<string, unknown>), { status: 201 })
}
