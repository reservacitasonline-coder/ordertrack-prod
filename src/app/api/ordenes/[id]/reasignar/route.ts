import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { tecnico_id } = await request.json()

  const { data: nuevo, error: techErr } = await supabase
    .from('usuarios')
    .select('id,nombre,rol,empresa_id')
    .eq('id', tecnico_id)
    .eq('rol', 'tecnico')
    .single()
  if (techErr || !nuevo) return errorResponse('El técnico destino no es válido', 400)
  if (user!.rol !== 'superadmin' && nuevo.empresa_id !== user!.empresa_id) {
    return errorResponse('El técnico no pertenece a su empresa', 400)
  }

  const { data: ot, error: fetchErr } = await supabase.from('ordenes_trabajo').select('*').eq('id', id).single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ tecnico_asignado_id: tecnico_id })
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: ot.estado,
    usuario_id: user!.id,
    comentario: `Reasignación: de técnico ID ${ot.tecnico_asignado_id} a ${nuevo.nombre} (ID ${tecnico_id})`,
    origen: 'manual',
  })

  return Response.json(data)
}
