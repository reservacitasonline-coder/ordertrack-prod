import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: ot } = await supabase.from('ordenes_trabajo').select('empresa_id,tecnico_asignado_id').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('Sin acceso a esta orden', 403)

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

  const { data: ot } = await supabase.from('ordenes_trabajo').select('empresa_id,tecnico_asignado_id,estado').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('Sin acceso a esta orden', 403)

  let alertaCritica = false

  for (const resp of respuestas) {
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

    if (resp.cumple === false) {
      const { data: item } = await supabase.from('seguridad_items').select('es_critico').eq('id', resp.seguridad_item_id).single()
      if (item?.es_critico) alertaCritica = true
    }
  }

  if (alertaCritica) {
    await supabase.from('ot_eventos').insert({
      ot_id: parseInt(id),
      estado_anterior: ot.estado,
      estado_nuevo: ot.estado,
      usuario_id: user!.id,
      comentario: '⚠️ ALERTA DE SEGURIDAD: Ítem crítico del checklist no cumplido.',
      origen: 'sistema',
    })
  }

  const { data, error } = await supabase.from('ot_seguridad_respuestas').select('*').eq('ot_id', id)
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
