import { createServiceClient, errorResponse, esFuncionInexistente } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const payload: Array<{ material_id: number; cantidad: number; foto_antes?: string; foto_despues?: string }> = await request.json()

  const { data: ot } = await supabase.from('ordenes_trabajo').select('tecnico_asignado_id,empresa_id').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  // Validar todo el payload ANTES de tocar inventario: si algo falla no queda a medias
  if (!Array.isArray(payload)) return errorResponse('Se esperaba una lista de repuestos', 400)
  for (const rep of payload) {
    const cantidad = Number(rep?.cantidad)
    if (!Number.isInteger(Number(rep?.material_id)) || !Number.isFinite(cantidad) || cantidad <= 0) {
      return errorResponse('Cada repuesto requiere material_id y cantidad mayor a 0', 400)
    }
  }
  const materialIds = Array.from(new Set(payload.map((r) => Number(r.material_id))))
  if (materialIds.length > 0) {
    const { data: mats } = await supabase
      .from('repuestos_materiales')
      .select('id')
      .in('id', materialIds)
      .eq('empresa_id', ot.empresa_id)
    const validos = new Set((mats ?? []).map((m: { id: number }) => m.id))
    const invalido = materialIds.find((mid) => !validos.has(mid))
    if (invalido !== undefined) return errorResponse(`Repuesto ${invalido} no pertenece a su empresa`, 400)
  }

  const consultarUsados = () =>
    supabase
      .from('ot_repuestos_usados')
      .select('*, material:repuestos_materiales(id,nombre,codigo,unidad_medida)')
      .eq('ot_id', id)

  // Camino atómico: una sola transacción en la base (migración inventario_atomico).
  const rpc = await supabase.rpc('registrar_repuestos_ot', {
    p_ot_id: parseInt(id),
    p_tecnico_id: user!.id,
    p_items: payload.map((rep) => ({
      material_id: Number(rep.material_id),
      cantidad: Number(rep.cantidad),
      foto_antes: rep.foto_antes ?? null,
      foto_despues: rep.foto_despues ?? null,
    })),
  })
  if (!rpc.error) {
    const { data: usados, error: usadosErr } = await consultarUsados()
    if (usadosErr) return errorResponse(usadosErr.message)
    return Response.json(usados)
  }
  if (!esFuncionInexistente(rpc.error)) return errorResponse(rpc.error.message)

  // Respaldo mientras la migración no esté aplicada (no es atómico)
  // Restore previous inventory quantities before clearing existing used parts
  const { data: prevUsed } = await supabase
    .from('ot_repuestos_usados')
    .select('material_id, cantidad')
    .eq('ot_id', id)

  for (const prev of prevUsed ?? []) {
    const { data: inv } = await supabase
      .from('inventario_tecnicos')
      .select('id, cantidad')
      .eq('tecnico_id', user!.id)
      .eq('material_id', prev.material_id)
      .single()
    if (inv) {
      await supabase
        .from('inventario_tecnicos')
        .update({ cantidad: Number(inv.cantidad) + Number(prev.cantidad) })
        .eq('id', inv.id)
    }
  }

  // Clear existing
  await supabase.from('ot_repuestos_usados').delete().eq('ot_id', id)

  for (const rep of payload) {
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
        .update({ cantidad: Number(inv.cantidad) - Number(rep.cantidad) })
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

  const { data, error } = await consultarUsados()

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
