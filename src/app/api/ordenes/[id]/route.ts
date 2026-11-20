import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'
import { OT_CAMPOS_EDITAR, pickCampos, validarRefsOT } from '../../_lib/ordenes'

const OT_SELECT =
  '*, cliente:clientes(id,nombre,ruc,telefono), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre,email), plantilla:plantillas_trabajo!plantilla_id(id,titulo,tiempo_estimado_minutos,items:plantilla_items(*),plantilla_items(*)), ot_plantillas:ot_plantillas_association(plantilla:plantillas_trabajo(id,titulo,tiempo_estimado_minutos,items:plantilla_items(*)))'

function normalizeOTDetail(row: Record<string, unknown>) {
  const assoc = Array.isArray(row.ot_plantillas) ? row.ot_plantillas : []
  const fromAssoc = assoc
    .map((a: { plantilla?: unknown }) => a?.plantilla)
    .filter(Boolean)
  const singlePlan = row.plantilla as Record<string, unknown> | null
  const plantillas =
    fromAssoc.length > 0
      ? fromAssoc
      : singlePlan
      ? [singlePlan]
      : []
  const copy = { ...row, plantillas }
  delete (copy as Record<string, unknown>).ot_plantillas
  return copy
}

async function getOT(supabase: ReturnType<typeof createServiceClient>, id: string, empresaId: number | null, rol: string) {
  let query = supabase.from('ordenes_trabajo').select(OT_SELECT).eq('id', id)
  if (rol !== 'superadmin') {
    // Sin empresa no hay nada que mostrar: nunca caer en una consulta sin filtro
    if (!empresaId) return { data: null, error: { message: 'Orden no encontrada' } }
    query = query.eq('empresa_id', empresaId)
  }
  const { data, error } = await query.single()
  return { data: data ? normalizeOTDetail(data as Record<string, unknown>) : null, error }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (error || !data) return errorResponse(error?.message || 'Orden no encontrada', 404)

  if (user!.rol === 'tecnico' && (data as { tecnico_asignado_id?: number }).tecnico_asignado_id !== user!.id) {
    return errorResponse('Sin permisos para acceder a esta orden', 403)
  }

  // Cargar plantillas de seguridad asociadas si existen
  try {
    const { data: sPlans } = await supabase
      .from('ot_seguridad_plantillas')
      .select('plantilla_id, plantilla:plantillas_seguridad(id, titulo, categoria, descripcion)')
      .eq('ot_id', id)

    if (sPlans && sPlans.length > 0) {
      ;(data as Record<string, unknown>).plantillas_seguridad = sPlans
        .map((sp: { plantilla?: unknown }) => sp.plantilla)
        .filter(Boolean)
    }
  } catch {
    // Si la tabla no está creada aún, continuar sin error
  }

  return Response.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: actual, error: fetchErr } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (fetchErr || !actual) return errorResponse('Orden no encontrada', 404)
  const otActual = actual as Record<string, unknown>
  const empresaOt = Number(otActual.empresa_id)

  const body = (await request.json()) as Record<string, unknown>

  // Lista blanca: `estado`, `empresa_id`, firmas y fechas de control no se editan por aquí.
  const updateFields = pickCampos(body, OT_CAMPOS_EDITAR)
  const plantilla_ids = Array.isArray(body.plantilla_ids) ? (body.plantilla_ids as unknown[]) : undefined

  if (body.tecnico_asignado_id !== undefined) {
    updateFields.tecnico_asignado_id = body.tecnico_asignado_id
  } else if (body.tecnico_id !== undefined) {
    updateFields.tecnico_asignado_id = body.tecnico_id
  }
  if (body.plantilla_id !== undefined) {
    updateFields.plantilla_id = body.plantilla_id
  } else if (plantilla_ids !== undefined) {
    updateFields.plantilla_id = plantilla_ids.length > 0 ? Number(plantilla_ids[0]) : null
  }

  // Toda referencia debe pertenecer a la empresa de la orden
  const refErr = await validarRefsOT(supabase, empresaOt, {
    cliente_id: updateFields.cliente_id,
    tecnico_asignado_id: updateFields.tecnico_asignado_id,
    plantilla_id: updateFields.plantilla_id,
    plantilla_ids,
    equipo_principal_id: updateFields.equipo_principal_id,
  })
  if (refErr) return errorResponse(refErr, 400)

  // Update plantilla associations if provided
  if (plantilla_ids !== undefined) {
    await supabase.from('ot_plantillas_association').delete().eq('ot_id', id)
    if (plantilla_ids.length > 0) {
      await supabase.from('ot_plantillas_association').insert(
        Array.from(new Set(plantilla_ids.map(Number))).map((pid) => ({ ot_id: parseInt(id), plantilla_id: pid }))
      )
    }
  }

  // Update plantillas de seguridad associations if provided
  const plantilla_seguridad_ids = Array.isArray(body.plantilla_seguridad_ids)
    ? (body.plantilla_seguridad_ids as unknown[])
    : undefined

  if (plantilla_seguridad_ids !== undefined) {
    try {
      await supabase.from('ot_seguridad_plantillas').delete().eq('ot_id', id)
      if (plantilla_seguridad_ids.length > 0) {
        await supabase.from('ot_seguridad_plantillas').insert(
          Array.from(new Set(plantilla_seguridad_ids.map(Number))).map((psid) => ({
            ot_id: parseInt(id),
            plantilla_id: psid,
          }))
        )
      }
    } catch (err) {
      console.warn('No se pudo actualizar ot_seguridad_plantillas:', err)
    }
  }

  let data: Record<string, unknown> | null = null
  if (Object.keys(updateFields).length > 0) {
    const res = await supabase
      .from('ordenes_trabajo')
      .update(updateFields)
      .eq('id', id)
      .eq('empresa_id', empresaOt)
      .select(OT_SELECT)
      .single()
    if (res.error) return errorResponse(res.error.message)
    data = res.data as unknown as Record<string, unknown>
  } else {
    const res = await getOT(supabase, id, user!.empresa_id, user!.rol)
    if (res.error || !res.data) return errorResponse('Orden no encontrada', 404)
    return Response.json(res.data)
  }

  // El estado no cambia en una edición: se registra el mismo estado en ambos campos
  // (ot_eventos.estado_nuevo es NOT NULL).
  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: otActual.estado,
    estado_nuevo: otActual.estado,
    usuario_id: user!.id,
    comentario: 'Orden de trabajo modificada / editada',
    origen: 'manual',
  })

  return Response.json(normalizeOTDetail(data))
}

export const PUT = PATCH

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: existing, error: fetchErr } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (fetchErr || !existing) return errorResponse('Orden no encontrada', 404)

  const existingRecord = existing as Record<string, unknown>
  if (['CERRADA', 'ANULADA'].includes(String(existingRecord.estado))) {
    return errorResponse('La orden ya está cerrada o anulada', 400)
  }

  const { error } = await supabase
    .from('ordenes_trabajo')
    .update({ estado: 'ANULADA' })
    .eq('id', id)

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: existingRecord.estado,
    estado_nuevo: 'ANULADA',
    usuario_id: user!.id,
    comentario: 'Orden anulada',
    origen: 'manual',
  })

  return new Response(null, { status: 204 })
}
