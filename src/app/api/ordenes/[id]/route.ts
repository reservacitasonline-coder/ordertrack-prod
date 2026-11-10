import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const OT_SELECT = '*, cliente:clientes(id,nombre,ruc,telefono,direccion), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre,email,telefono), plantilla:plantillas_trabajo(id,titulo,tiempo_estimado_minutos,plantilla_items(*))'

async function getOT(supabase: ReturnType<typeof createServiceClient>, id: string, empresaId: number | null, rol: string) {
  let query = supabase.from('ordenes_trabajo').select(OT_SELECT).eq('id', id)
  if (rol !== 'superadmin' && empresaId) query = query.eq('empresa_id', empresaId)
  const { data, error } = await query.single()
  return { data, error }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (error) return errorResponse(error.message, 404)

  if (user!.rol === 'tecnico' && data.tecnico_asignado_id !== user!.id) {
    return errorResponse('Sin permisos para acceder a esta orden', 403)
  }
  return Response.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { data: existing, error: fetchErr } = await getOT(supabase, id, user!.empresa_id, user!.rol)
  if (fetchErr) return errorResponse(fetchErr.message, 404)

  const body = await request.json()
  const { plantilla_ids, ...updateFields } = body

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update(updateFields)
    .eq('id', id)
    .select(OT_SELECT)
    .single()

  if (error) return errorResponse(error.message)

  // Update plantilla associations if provided
  if (plantilla_ids !== undefined) {
    await supabase.from('ot_plantillas_association').delete().eq('ot_id', id)
    if (plantilla_ids.length > 0) {
      await supabase.from('ot_plantillas_association').insert(
        plantilla_ids.map((pid: number) => ({ ot_id: parseInt(id), plantilla_id: pid }))
      )
    }
  }

  return Response.json(data)
}
