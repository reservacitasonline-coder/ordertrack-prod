import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '../../_lib/auth'

export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(id,nombre,direccion), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre), plantilla:plantillas_trabajo(id,titulo)')
    .eq('empresa_id', user!.empresa_id)
    .in('estado', ['PROGRAMADA', 'EN_EJECUCION', 'ESPERANDO_REPUESTO'])

  if (error) return errorResponse(error.message)

  const PRIORITY: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 }
  const sorted = (data ?? []).sort((a, b) => {
    if (a.tecnico_asignado_id !== b.tecnico_asignado_id) return (a.tecnico_asignado_id ?? 0) - (b.tecnico_asignado_id ?? 0)
    if (a.cliente_id !== b.cliente_id) return a.cliente_id - b.cliente_id
    return (PRIORITY[a.prioridad] ?? 4) - (PRIORITY[b.prioridad] ?? 4)
  })

  return Response.json(sorted)
}
