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
  const { material_id, nombre_otro, cantidad } = await request.json()

  const { data: ot } = await supabase.from('ordenes_trabajo').select('*').eq('id', id).single()
  if (!ot) return errorResponse('Orden no encontrada', 404)
  if (ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)
  if (ot.estado !== 'EN_EJECUCION') return errorResponse('La orden debe estar EN_EJECUCION', 400)

  if (material_id) {
    const { data: mat } = await supabase.from('repuestos_materiales').select('id').eq('id', material_id).eq('empresa_id', ot.empresa_id).single()
    if (!mat) return errorResponse('Material no encontrado en su empresa', 400)
  }

  await supabase.from('ordenes_trabajo').update({ estado: 'ESPERANDO_REPUESTO' }).eq('id', id)

  const { data: pendiente, error } = await supabase
    .from('ot_repuestos_pendientes')
    .insert({ ot_id: parseInt(id), material_id: material_id ?? null, nombre_otro: nombre_otro ?? null, cantidad, estado: 'SOLICITADO' })
    .select()
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: 'EN_EJECUCION',
    estado_nuevo: 'ESPERANDO_REPUESTO',
    usuario_id: user!.id,
    comentario: `Repuesto solicitado: ${nombre_otro || `Material ID ${material_id}`} (Cant: ${cantidad})`,
    origen: 'manual',
  })

  return Response.json(pendiente, { status: 201 })
}
