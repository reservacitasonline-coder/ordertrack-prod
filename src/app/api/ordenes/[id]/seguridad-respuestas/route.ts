import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const { data, error } = await supabase
    .from('ot_seguridad_respuestas')
    .select('*, seguridad_item:seguridad_items(id,pregunta,requerido,es_critico)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const sItem = row.seguridad_item as { pregunta?: string } | null
    return {
      ...row,
      pregunta: sItem?.pregunta ?? null,
      respuesta: row.cumple === true ? 'si' : row.cumple === false ? 'no' : 'na',
      justificacion: row.motivo_no_cumplimiento ?? null,
    }
  })

  return Response.json(mapped)
}
