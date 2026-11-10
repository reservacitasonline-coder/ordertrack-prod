import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '../../../_lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: original, error: fetchErr } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)

  if (!['COMPLETADA', 'CERRADA'].includes(original.estado)) {
    return errorResponse('Solo se pueden reabrir órdenes COMPLETADA o CERRADA', 400)
  }

  const num = Math.floor(Math.random() * 900) + 100
  const new_code = `${original.codigo_interno}-R${num}`

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      empresa_id: original.empresa_id,
      codigo_interno: new_code,
      codigo_externo: original.codigo_externo,
      cliente_id: original.cliente_id,
      canal_id: original.canal_id,
      titulo: `[GARANTÍA] ${original.titulo}`,
      descripcion: `Reapertura por garantía de OT ${original.codigo_interno}. ${original.descripcion}`,
      prioridad: 'alta',
      estado: 'RECIBIDA',
      tecnico_asignado_id: original.tecnico_asignado_id,
      plantilla_id: original.plantilla_id,
      es_reapertura: true,
      ot_original_id: original.id,
    })
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: data.id,
    estado_anterior: null,
    estado_nuevo: 'RECIBIDA',
    usuario_id: user!.id,
    comentario: `Reapertura por garantía vinculada a OT ${original.codigo_interno}`,
    origen: 'manual',
  })

  return Response.json(data, { status: 201 })
}
