import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { respuestas } = await request.json()

  const { data: ot } = await supabase.from('ordenes_trabajo').select('tecnico_asignado_id,empresa_id').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  const itemIds = (respuestas ?? []).map((r: { plantilla_item_id: number }) => r.plantilla_item_id).filter(Boolean)
  let validIds = new Set<number>()
  if (itemIds.length > 0) {
    const { data: existingItems } = await supabase
      .from('plantilla_items')
      .select('id')
      .in('id', itemIds)
    validIds = new Set((existingItems ?? []).map((it: { id: number }) => it.id))
  }

  for (const resp of respuestas ?? []) {
    if (!validIds.has(resp.plantilla_item_id)) continue

    // Upsert: delete existing then insert
    await supabase.from('ot_checklist_respuestas')
      .delete()
      .eq('ot_id', id)
      .eq('plantilla_item_id', resp.plantilla_item_id)

    await supabase.from('ot_checklist_respuestas').insert({
      ot_id: parseInt(id),
      plantilla_item_id: resp.plantilla_item_id,
      valor_texto: resp.valor_texto ?? null,
      valor_numerico: resp.valor_numerico ?? null,
      valor_booleano: resp.valor_booleano ?? null,
      ruta_foto: resp.ruta_foto ?? null,
      foto_antes: resp.foto_antes ?? null,
      foto_despues: resp.foto_despues ?? null,
    })
  }

  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .select('*, plantilla_item:plantilla_items(id,pregunta,tipo_respuesta,orden)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
