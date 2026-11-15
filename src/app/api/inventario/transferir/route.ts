import { createServiceClient, errorResponse, esFuncionInexistente } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'
import { leerEmpresaConfig } from '../../_lib/empresa-config'

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

  // El admin de la empresa decide si el técnico puede cargar su propio kit
  if (user!.rol === 'tecnico') {
    const config = await leerEmpresaConfig(supabase, Number(tecnico.empresa_id))
    if (config && !config.tecnico_autotransferencia) {
      return errorResponse('Su empresa no permite que el técnico cargue su propio kit. Solicítelo a un administrador.', 403)
    }
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

  // Camino atómico: una sola transacción en la base (migración inventario_atomico).
  const rpc = await supabase.rpc('transferir_a_tecnico', {
    p_empresa_id: tecnico.empresa_id,
    p_tecnico_id: Number(tecnico_id),
    p_material_id: Number(material_id),
    p_cantidad: Number(cantidad),
  })
  if (!rpc.error) return Response.json({ ok: true }, { status: 201 })
  if (!esFuncionInexistente(rpc.error)) return errorResponse(rpc.error.message)

  // Respaldo mientras la migración no esté aplicada (no es atómico)
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
