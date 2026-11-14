import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

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
  if (rol !== 'superadmin' && empresaId) query = query.eq('empresa_id', empresaId)
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
  const { error: fetchErr } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (fetchErr) return errorResponse(fetchErr.message, 404)

  const body = await request.json()
  const { plantilla_ids, tecnico_id, ...updateFields } = body
  if (user!.rol !== 'superadmin') {
    delete updateFields.empresa_id
  }
  if (tecnico_id !== undefined && updateFields.tecnico_asignado_id === undefined) {
    updateFields.tecnico_asignado_id = tecnico_id
  }
  if (Array.isArray(plantilla_ids) && updateFields.plantilla_id === undefined) {
    updateFields.plantilla_id = plantilla_ids.length > 0 ? Number(plantilla_ids[0]) : null
  }

  // Update plantilla associations if provided
  if (plantilla_ids !== undefined) {
    await supabase.from('ot_plantillas_association').delete().eq('ot_id', id)
    if (Array.isArray(plantilla_ids) && plantilla_ids.length > 0) {
      await supabase.from('ot_plantillas_association').insert(
        plantilla_ids.map((pid: number) => ({ ot_id: parseInt(id), plantilla_id: Number(pid) }))
      )
    }
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(updateFields)
    .eq('id', id)
    .select(OT_SELECT)
    .single()

  if (error) return errorResponse(error.message)

  return Response.json(normalizeOTDetail(data as Record<string, unknown>))
}

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
