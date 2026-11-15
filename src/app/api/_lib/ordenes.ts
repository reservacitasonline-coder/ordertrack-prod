// Reglas compartidas para crear/editar órdenes de trabajo.
// Todo lo que llega del cliente pasa por lista blanca y validación de empresa:
// las API Routes usan service role (sin RLS), así que el aislamiento multi-tenant
// depende de estas comprobaciones.
import type { SupabaseClient } from '@supabase/supabase-js'

// Campos que el cliente puede fijar al crear una OT (el resto lo decide el servidor).
export const OT_CAMPOS_CREAR = [
  'cliente_id',
  'titulo',
  'descripcion',
  'codigo_externo',
  'prioridad',
  'prioridad_origen',
  'fecha_programada',
  'monto',
  'canal_id',
  'equipo_principal_id',
] as const

// Campos editables por PATCH. `estado` queda fuera a propósito: solo cambia por /transicion.
export const OT_CAMPOS_EDITAR = [
  'cliente_id',
  'titulo',
  'descripcion',
  'codigo_externo',
  'prioridad',
  'fecha_programada',
  'monto',
  'equipo_principal_id',
] as const

// Estados con los que se puede crear una OT manualmente.
export const ESTADOS_INICIALES = ['RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA'] as const

export function pickCampos(
  body: Record<string, unknown>,
  permitidos: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of permitidos) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

// Número base de un código interno. Ignora el sufijo de reapertura:
// "OT-00012" → 12, "OT-00012-R345" → 12. Devuelve null si no reconoce el formato.
export function numeroDeCodigo(codigo: string | null | undefined): number | null {
  if (!codigo) return null
  const match = String(codigo).match(/^OT-(\d+)/i)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

export function formatearCodigo(numero: number): string {
  return `OT-${String(numero).padStart(5, '0')}`
}

// Siguiente código a partir del último código regular (no reapertura) de la empresa.
export function siguienteCodigo(ultimoCodigo: string | null | undefined, intento = 0): string {
  const base = numeroDeCodigo(ultimoCodigo) ?? 0
  return formatearCodigo(base + 1 + intento)
}

export function esConflictoDeCodigo(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '23505' ||
    Boolean(error.message?.includes('codigo_interno')) ||
    Boolean(error.message?.includes('uq_ot_empresa_codigo'))
  )
}

function idsValidos(valores: unknown[]): number[] | null {
  const out: number[] = []
  for (const v of valores) {
    const n = Number(v)
    if (!Number.isInteger(n) || n <= 0) return null
    out.push(n)
  }
  return out
}

export interface RefsOT {
  cliente_id?: unknown
  tecnico_asignado_id?: unknown
  plantilla_id?: unknown
  plantilla_ids?: unknown
  equipo_principal_id?: unknown
}

// Verifica que cada referencia pertenezca a la empresa de la OT.
// Devuelve un mensaje de error o null si todo es válido.
export async function validarRefsOT(
  supabase: SupabaseClient,
  empresaId: number,
  refs: RefsOT
): Promise<string | null> {
  if (refs.cliente_id !== undefined && refs.cliente_id !== null) {
    const ids = idsValidos([refs.cliente_id])
    if (!ids) return 'cliente_id inválido'
    const { data } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', ids[0])
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!data) return 'El cliente no pertenece a su empresa'
  }

  if (refs.tecnico_asignado_id !== undefined && refs.tecnico_asignado_id !== null) {
    const ids = idsValidos([refs.tecnico_asignado_id])
    if (!ids) return 'tecnico_asignado_id inválido'
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', ids[0])
      .eq('empresa_id', empresaId)
      .eq('rol', 'tecnico')
      .eq('activo', true)
      .maybeSingle()
    if (!data) return 'El técnico no es válido para su empresa'
  }

  const plantillas: unknown[] = []
  if (refs.plantilla_id !== undefined && refs.plantilla_id !== null) plantillas.push(refs.plantilla_id)
  if (Array.isArray(refs.plantilla_ids)) plantillas.push(...refs.plantilla_ids)
  if (plantillas.length > 0) {
    const ids = idsValidos(plantillas)
    if (!ids) return 'plantilla_ids inválido'
    const unicos = Array.from(new Set(ids))
    const { data } = await supabase
      .from('plantillas_trabajo')
      .select('id')
      .in('id', unicos)
      .eq('empresa_id', empresaId)
    if ((data ?? []).length !== unicos.length) return 'Alguna plantilla no pertenece a su empresa'
  }

  if (refs.equipo_principal_id !== undefined && refs.equipo_principal_id !== null) {
    const ids = idsValidos([refs.equipo_principal_id])
    if (!ids) return 'equipo_principal_id inválido'
    const { data } = await supabase
      .from('equipos')
      .select('id')
      .eq('id', ids[0])
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!data) return 'El equipo no pertenece a su empresa'
  }

  return null
}
