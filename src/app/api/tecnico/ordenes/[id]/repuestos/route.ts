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
  const payload: Array<{ material_id: number; cantidad: number; foto_antes?: string; foto_despues?: string }> = await request.json()

  const { data: ot } = await supabase.from('ordenes_trabajo').select('tecnico_asignado_id,empresa_id').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  // Clear existing
  await supabase.from('ot_repuestos_usados').delete().eq('ot_id', id)

  for (const rep of payload) {
    // Validate material belongs to same enterprise
    const { data: mat } = await supabase
      .from('repuestos_materiales')
      .select('id,nombre')
      .eq('id', rep.material_id)
      .eq('empresa_id', ot.empresa_id)
      .single()

    if (!mat) return errorResponse(`Repuesto ${rep.material_id} no pertenece a su empresa`, 400)

    // Decrement technician inventory
    const { data: inv } = await supabase
      .from('inventario_tecnicos')
      .select('id,cantidad,cantidad_minima')
      .eq('tecnico_id', user!.id)
      .eq('material_id', rep.material_id)
      .single()

    if (inv) {
      await supabase
        .from('inventario_tecnicos')
        .update({ cantidad: inv.cantidad - rep.cantidad })
        .eq('id', inv.id)
    }

    await supabase.from('ot_repuestos_usados').insert({
      ot_id: parseInt(id),
      material_id: rep.material_id,
      cantidad: rep.cantidad,
      foto_antes: rep.foto_antes ?? null,
      foto_despues: rep.foto_despues ?? null,
    })
  }

  const { data, error } = await supabase
    .from('ot_repuestos_usados')
    .select('*, material:repuestos_materiales(id,nombre,codigo,unidad_medida)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
