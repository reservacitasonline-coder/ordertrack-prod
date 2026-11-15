import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'
import { esConflictoDeCodigo } from '../../../_lib/ordenes'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { ot: original, error: accessErr } = await verifyOtAccess<Record<string, any>>(supabase, id, user!, { columns: '*' })
  if (accessErr || !original) return accessErr!

  if (!['COMPLETADA', 'CERRADA'].includes(original.estado)) {
    return errorResponse('Solo se pueden reabrir órdenes COMPLETADA o CERRADA', 400)
  }

  // Sufijo correlativo por orden original (-R1, -R2, ...) con reintento ante colisión.
  const { count } = await supabase
    .from('ordenes_trabajo')
    .select('id', { count: 'exact', head: true })
    .eq('ot_original_id', original.id)

  let data: { id: number } | null = null
  let error: { message: string; code?: string } | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const new_code = `${original.codigo_interno}-R${(count ?? 0) + 1 + attempt}`
    const res = await supabase
      .from('ordenes_trabajo')
      .insert({
        empresa_id: original.empresa_id,
        codigo_interno: new_code,
        codigo_externo: original.codigo_externo,
        cliente_id: original.cliente_id,
        canal_id: original.canal_id,
        titulo: `[GARANTÍA] ${original.titulo}`,
        descripcion: `Reapertura por garantía de OT ${original.codigo_interno}. ${original.descripcion ?? ''}`.trim(),
        prioridad: 'alta',
        estado: 'RECIBIDA',
        tecnico_asignado_id: original.tecnico_asignado_id,
        plantilla_id: original.plantilla_id,
        es_reapertura: true,
        ot_original_id: original.id,
      })
      .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
      .single()

    if (!res.error && res.data) {
      data = res.data as unknown as { id: number }
      error = null
      break
    }
    error = res.error
    if (!esConflictoDeCodigo(res.error)) break
  }

  if (error || !data) return errorResponse(error?.message || 'Error al reabrir la orden')

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
