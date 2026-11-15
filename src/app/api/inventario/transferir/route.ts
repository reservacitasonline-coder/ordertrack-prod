import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador', 'tecnico'])
  if (rolesErr) return rolesErr

  const { tecnico_id, material_id, cantidad } = await request.json()
  if (!tecnico_id || !material_id || !Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
    return errorResponse('tecnico_id, material_id y cantidad (> 0) son requeridos', 400)
  }

  if (user!.rol === 'tecnico' && user!.id !== Number(tecnico_id)) {
    return errorResponse('Sin permisos para transferir a otro técnico', 403)
  }

  const supabase = createServiceClient()

  // Verificar que el técnico existe y tiene empresa_id
  const { data: tecnico } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', tecnico_id)
    .eq('rol', 'tecnico')
    .single()

  if (!tecnico) return errorResponse('Técnico no encontrado', 404)

  if (user!.rol !== 'superadmin' && tecnico.empresa_id !== user!.empresa_id) {
    return errorResponse('El técnico no pertenece a su empresa', 403)
  }

  // Verificar que el material pertenece a la misma empresa
  const { data: material } = await supabase
    .from('repuestos_materiales')
    .select('id, empresa_id')
    .eq('id', material_id)
    .single()

  if (!material || (tecnico.empresa_id && material.empresa_id !== tecnico.empresa_id)) {
    return errorResponse('Material no encontrado en la empresa', 404)
  }

  // Registrar la transferencia
  const { error: txErr } = await supabase
    .from('transferencias_inventario')
    .insert({
      empresa_id: tecnico.empresa_id,
      tecnico_id,
      material_id,
      cantidad,
    })

  if (txErr) return errorResponse(txErr.message)

  // Upsert en inventario_tecnicos (incrementar cantidad)
  const { data: existing } = await supabase
    .from('inventario_tecnicos')
    .select('id, cantidad')
    .eq('tecnico_id', tecnico_id)
    .eq('material_id', material_id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('inventario_tecnicos')
      .update({ cantidad: Number(existing.cantidad) + Number(cantidad) })
      .eq('id', existing.id)
    if (error) return errorResponse(error.message)
  } else {
    const { error } = await supabase
      .from('inventario_tecnicos')
      .insert({ tecnico_id, material_id, cantidad, cantidad_minima: 0 })
    if (error) return errorResponse(error.message)
  }

  return Response.json({ ok: true }, { status: 201 })
}
