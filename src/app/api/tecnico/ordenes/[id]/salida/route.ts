import { coordenada, createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  // Coordenadas reales o null ("sin GPS"); nunca valores por defecto
  const latitud_salida = coordenada(body.latitud_salida, 90)
  const longitud_salida = coordenada(body.longitud_salida, 180)
  const gpsTexto = latitud_salida !== null && longitud_salida !== null ? `${latitud_salida}, ${longitud_salida}` : 'sin GPS'

  const { data: ot, error: fetchErr } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)
  if (ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  if (!['PROGRAMADA', 'APROBADA', 'RECIBIDA', 'EN_REVISION'].includes(ot.estado)) {
    return errorResponse(`No se puede iniciar traslado en estado ${ot.estado}`, 400)
  }

  const ahora = new Date().toISOString()
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ estado: 'EN_EJECUCION', fecha_salida: ahora, fecha_inicio_real: ahora, latitud_salida, longitud_salida })
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: 'EN_EJECUCION',
    usuario_id: user!.id,
    comentario: `Inicio traslado. GPS: ${gpsTexto}`,
    origen: 'manual',
  })

  return Response.json(data)
}
