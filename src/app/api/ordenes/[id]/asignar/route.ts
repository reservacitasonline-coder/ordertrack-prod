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
  const { tecnico_asignado_id } = await request.json()

  // Validate tech belongs to same enterprise and is a tecnico
  const { data: tecnico, error: techErr } = await supabase
    .from('usuarios')
    .select('id,nombre,rol,empresa_id,activo')
    .eq('id', tecnico_asignado_id)
    .eq('activo', true)
    .single()

  if (techErr || !tecnico) return errorResponse('Técnico no encontrado', 404)
  if (tecnico.rol !== 'tecnico') return errorResponse('El usuario no es un técnico', 400)
  if (user!.rol !== 'superadmin' && tecnico.empresa_id !== user!.empresa_id) {
    return errorResponse('El técnico no pertenece a su empresa', 400)
  }

  const { data: ot, error: fetchErr } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({ tecnico_asignado_id })
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: ot.estado,
    usuario_id: user!.id,
    comentario: `Técnico asignado: ${tecnico.nombre}`,
    origen: 'manual',
  })

  return Response.json(data)
}
