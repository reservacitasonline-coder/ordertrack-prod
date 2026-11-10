import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '../../../../_lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { latitud_llegada, longitud_llegada } = await request.json()

  const { data: ot, error: fetchErr } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)
  if (ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  if (ot.estado !== 'EN_EJECUCION' || !ot.fecha_salida) {
    return errorResponse('Debe haber iniciado traslado previamente', 400)
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ fecha_llegada: new Date().toISOString(), latitud_llegada, longitud_llegada })
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: 'EN_EJECUCION',
    estado_nuevo: 'EN_EJECUCION',
    usuario_id: user!.id,
    comentario: `Llegada confirmada. GPS: ${latitud_llegada}, ${longitud_llegada}`,
    origen: 'manual',
  })

  return Response.json(data)
}
