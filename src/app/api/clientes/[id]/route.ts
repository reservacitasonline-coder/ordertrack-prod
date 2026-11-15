import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const BUCKET_CONTRATOS = 'contratos'

async function getContratoData(supabase: ReturnType<typeof createServiceClient>, id: string) {
  try {
    const { data: fileData, error: fileErr } = await supabase.storage
      .from(BUCKET_CONTRATOS)
      .download(`${id}/metadata.json`)

    if (!fileErr && fileData) {
      const text = await fileData.text()
      return JSON.parse(text)
    }
  } catch (err) {
    console.warn(`No se pudo leer contrato para cliente ${id}:`, err)
  }
  return null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()

  let query = supabase.from('clientes').select('*').eq('id', id)
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data: cliente, error } = await query.single()
  if (error || !cliente) return errorResponse('Cliente no encontrado', 404)

  // Cargar metadatos de contrato, OTs asociadas y equipos vinculados
  const [contrato, ordenesRes, equiposRes] = await Promise.all([
    getContratoData(supabase, id),
    supabase
      .from('ordenes_trabajo')
      .select('id, codigo_interno, titulo, estado, prioridad, created_at, fecha_programada')
      .eq('cliente_id', id)
      .order('id', { ascending: false }),
    supabase
      .from('equipos')
      .select('id, nombre, codigo_inventario, tipo:equipo_tipos(id,nombre,categoria:equipo_categorias(id,nombre))')
      .eq('cliente_id', id)
      .eq('activo', true)
      .order('nombre'),
  ])

  const allOrdenes = ordenesRes.data ?? []
  const total_ordenes = allOrdenes.length
  const ordenes_activas = allOrdenes.filter(
    (o) => !['COMPLETADA', 'CERRADA', 'ANULADA'].includes(o.estado)
  ).length
  const ordenes_completadas = allOrdenes.filter((o) =>
    ['COMPLETADA', 'CERRADA'].includes(o.estado)
  ).length
  const total_equipos = equiposRes.data?.length ?? 0

  return Response.json({
    ...cliente,
    contrato,
    stats: {
      total_ordenes,
      ordenes_activas,
      ordenes_completadas,
      total_equipos,
    },
    ultimas_ordenes: allOrdenes.slice(0, 8),
    equipos: equiposRes.data ?? [],
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  // Edición permitida EXCLUSIVAMENTE para superadmin y admin
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const { contrato, ...clienteFields } = body

  if (user!.rol !== 'superadmin') {
    delete clienteFields.empresa_id
  }

  let updatedCliente = null
  if (Object.keys(clienteFields).length > 0) {
    let query = supabase.from('clientes').update(clienteFields).eq('id', id)
    if (user!.rol !== 'superadmin') {
      query = query.eq('empresa_id', user!.empresa_id)
    }
    const { data, error } = await query.select().single()
    if (error || !data) return errorResponse(error?.message || 'Error al actualizar cliente', 400)
    updatedCliente = data
  } else {
    let query = supabase.from('clientes').select('*').eq('id', id)
    if (user!.rol !== 'superadmin') {
      query = query.eq('empresa_id', user!.empresa_id)
    }
    const { data } = await query.single()
    updatedCliente = data
  }

  // Si se proporcionó información de contrato, persistir en bucket privado 'contratos'
  let savedContrato = null
  if (contrato !== undefined) {
    const buffer = Buffer.from(JSON.stringify(contrato))
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_CONTRATOS)
      .upload(`${id}/metadata.json`, buffer, {
        contentType: 'application/json',
        upsert: true,
      })

    if (!uploadErr) {
      savedContrato = contrato
    } else {
      console.error('Error al guardar metadatos de contrato:', uploadErr)
    }
  } else {
    savedContrato = await getContratoData(supabase, id)
  }

  return Response.json({
    ...updatedCliente,
    contrato: savedContrato,
  })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  let query = supabase.from('clientes').delete().eq('id', id)
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { error } = await query
  if (error) return errorResponse(error.message)

  // Limpiar metadatos de contrato en storage si existen
  await supabase.storage.from(BUCKET_CONTRATOS).remove([`${id}/metadata.json`]).catch(() => {})

  return new Response(null, { status: 204 })
}
