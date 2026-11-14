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
    .from('ot_checklist_respuestas')
    .select('*, plantilla_item:plantilla_items(id,pregunta,tipo_respuesta,orden)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const pItem = row.plantilla_item as { pregunta?: string; tipo_respuesta?: string } | null
    return {
      ...row,
      pregunta: pItem?.pregunta ?? null,
      tipo_respuesta: pItem?.tipo_respuesta ?? null,
    }
  })

  return Response.json(mapped)
}
