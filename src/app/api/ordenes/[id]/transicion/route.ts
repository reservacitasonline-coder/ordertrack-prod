import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

// State machine — valid transitions per role (aligned with ot_estado enum and TRANSICIONES_PERMITIDAS)
const TRANSITIONS: Record<string, string[]> = {
  RECIBIDA: ['EN_REVISION', 'APROBADA', 'PROGRAMADA', 'RECHAZADA', 'ANULADA'],
  EN_REVISION: ['APROBADA', 'PROGRAMADA', 'RECHAZADA', 'ANULADA'],
  APROBADA: ['PROGRAMADA', 'EN_EJECUCION', 'PAUSADA', 'ANULADA'],
  RECHAZADA: ['EN_REVISION'],
  PROGRAMADA: ['EN_EJECUCION', 'PAUSADA', 'ANULADA'],
  EN_EJECUCION: ['PAUSADA', 'COMPLETADA', 'ESPERANDO_REPUESTO', 'PRECIERRE', 'EN_REVISION', 'ANULADA'],
  PAUSADA: ['EN_EJECUCION', 'PROGRAMADA', 'ANULADA'],
  ESPERANDO_REPUESTO: ['EN_EJECUCION', 'PROGRAMADA', 'ANULADA'],
  PRECIERRE: ['EN_EJECUCION', 'COMPLETADA', 'ANULADA'],
  COMPLETADA: ['CERRADA', 'EN_EJECUCION'],
  CERRADA: [],
  ANULADA: [],
}

const TECNICO_ALLOWED: Record<string, string[]> = {
  APROBADA: ['EN_EJECUCION'],
  PROGRAMADA: ['EN_EJECUCION', 'PAUSADA'],
  EN_EJECUCION: ['COMPLETADA', 'ESPERANDO_REPUESTO', 'PRECIERRE', 'PAUSADA'],
  PAUSADA: ['EN_EJECUCION'],
  ESPERANDO_REPUESTO: ['EN_EJECUCION'],
  PRECIERRE: ['EN_EJECUCION', 'COMPLETADA'],
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { estado_nuevo, comentario } = await request.json()

  let query = supabase.from('ordenes_trabajo').select('*').eq('id', id)
  if (user!.rol !== 'superadmin') query = query.eq('empresa_id', user!.empresa_id)
  const { data: ot, error: fetchErr } = await query.single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)

  if (user!.rol === 'tecnico' && ot.tecnico_asignado_id !== user!.id) {
    return errorResponse('Sin permisos para esta orden', 403)
  }

  const allowedForState = TRANSITIONS[ot.estado] ?? []
  if (!allowedForState.includes(estado_nuevo)) {
    return errorResponse(`Transición inválida: ${ot.estado} → ${estado_nuevo}`, 422)
  }

  if (user!.rol === 'tecnico') {
    const allowedForTech = TECNICO_ALLOWED[ot.estado] ?? []
    if (!allowedForTech.includes(estado_nuevo)) {
      return errorResponse(`El técnico no puede ejecutar esta transición`, 403)
    }
  }

  const updateData: Record<string, unknown> = { estado: estado_nuevo }
  if (estado_nuevo === 'COMPLETADA') updateData.fecha_cierre = new Date().toISOString()

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(updateData)
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo,
    usuario_id: user!.id,
    comentario: comentario || `Transición de estado: ${ot.estado} → ${estado_nuevo}`,
    origen: 'manual',
  })

  return Response.json(data)
}
