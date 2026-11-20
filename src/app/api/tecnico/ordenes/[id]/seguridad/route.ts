import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select('empresa_id,tecnico_asignado_id')
    .eq('id', id)
    .single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('Sin acceso a esta orden', 403)

  try {
    // 1. Verificar si la OT tiene plantillas de seguridad asignadas
    const { data: otPlantillas, error: otPlErr } = await supabase
      .from('ot_seguridad_plantillas')
      .select('plantilla_id, plantilla:plantillas_seguridad(id, titulo, categoria)')
      .eq('ot_id', id)

    if (!otPlErr && otPlantillas && otPlantillas.length > 0) {
      const pids = otPlantillas.map((r: { plantilla_id: number }) => r.plantilla_id)
      const { data: items, error: itemsErr } = await supabase
        .from('seguridad_items')
        .select('*, plantilla:plantillas_seguridad(id, titulo, categoria)')
        .in('plantilla_id', pids)
        .order('orden', { ascending: true })

      if (!itemsErr && items && items.length > 0) {
        return Response.json(items)
      }
    }
  } catch (err) {
    console.warn('Fallback a seguridad_items tradicional:', err)
  }

  // Fallback: Ítems generales de la empresa
  const { data, error } = await supabase
    .from('seguridad_items')
    .select('*')
    .eq('empresa_id', ot.empresa_id)
    .order('orden', { ascending: true })

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { respuestas } = await request.json()

  const { data: ot } = await supabase
    .from('ordenes_trabajo')
    .select('empresa_id,tecnico_asignado_id,estado')
    .eq('id', id)
    .single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('Sin acceso a esta orden', 403)

  const { data: validItems } = await supabase
    .from('seguridad_items')
    .select('id, es_critico')
    .eq('empresa_id', ot.empresa_id)
  const validMap = new Map((validItems ?? []).map((it: { id: number; es_critico: boolean }) => [it.id, it.es_critico]))

  let alertaCritica = false

  for (const resp of respuestas ?? []) {
    if (!validMap.has(resp.seguridad_item_id)) continue

    await supabase.from('ot_seguridad_respuestas').delete()
      .eq('ot_id', id)
      .eq('seguridad_item_id', resp.seguridad_item_id)

    await supabase.from('ot_seguridad_respuestas').insert({
      ot_id: parseInt(id),
      seguridad_item_id: resp.seguridad_item_id,
      cumple: resp.cumple,
      motivo_no_cumplimiento: resp.justificacion ?? resp.motivo_no_cumplimiento ?? null,
      ruta_foto: resp.ruta_foto ?? null,
    })

    if (resp.cumple === false && validMap.get(resp.seguridad_item_id)) {
      alertaCritica = true
    }
  }

  if (alertaCritica) {
    await supabase.from('ot_eventos').insert({
      ot_id: parseInt(id),
      estado_anterior: ot.estado,
      estado_nuevo: ot.estado,
      usuario_id: user!.id,
      comentario: '⚠️ ALERTA DE SEGURIDAD ELÉCTRICA: Ítem crítico del protocolo de seguridad no cumplido.',
      origen: 'sistema',
    })
  }

  const { data, error } = await supabase.from('ot_seguridad_respuestas').select('*').eq('ot_id', id)
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
