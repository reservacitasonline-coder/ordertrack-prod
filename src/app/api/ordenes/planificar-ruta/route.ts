import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  let query = supabase
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(id,nombre,ruc,telefono), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre), plantilla:plantillas_trabajo!plantilla_id(id,titulo,tiempo_estimado_minutos)')
    .in('estado', ['PROGRAMADA', 'EN_EJECUCION', 'ESPERANDO_REPUESTO'])

  if (user!.rol !== 'superadmin') {
    if (!user!.empresa_id) return errorResponse('Usuario sin empresa asignada', 403)
    query = query.eq('empresa_id', user!.empresa_id)
  }
  if (user!.rol === 'tecnico') {
    query = query.eq('tecnico_asignado_id', user!.id)
  }

  const { data, error } = await query

  if (error) return errorResponse(error.message)

  const PRIORITY: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 }
  const sorted = (data ?? []).sort((a, b) => {
    if (a.tecnico_asignado_id !== b.tecnico_asignado_id) return (a.tecnico_asignado_id ?? 0) - (b.tecnico_asignado_id ?? 0)
    if (a.cliente_id !== b.cliente_id) return a.cliente_id - b.cliente_id
    return (PRIORITY[a.prioridad] ?? 4) - (PRIORITY[b.prioridad] ?? 4)
  })

  return Response.json(sorted)
}
