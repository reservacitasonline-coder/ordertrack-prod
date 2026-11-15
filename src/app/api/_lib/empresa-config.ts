// Configuración por empresa que el admin puede cambiar.
// La columna vive en `empresas`; si la migración aún no se aplicó, se asume el
// comportamiento histórico (permitido) para no romper producción.
import type { SupabaseClient } from '@supabase/supabase-js'

export const COLUMNA_AUTOTRANSFERENCIA = 'tecnico_autotransferencia'

export interface EmpresaConfig {
  tecnico_autotransferencia: boolean
  migracion_pendiente: boolean
}

export async function leerEmpresaConfig(
  supabase: SupabaseClient,
  empresaId: number
): Promise<EmpresaConfig | null> {
  const { data, error } = await supabase.from('empresas').select('*').eq('id', empresaId).maybeSingle()
  if (error || !data) return null
  const fila = data as Record<string, unknown>
  const existe = COLUMNA_AUTOTRANSFERENCIA in fila
  return {
    tecnico_autotransferencia: existe ? fila[COLUMNA_AUTOTRANSFERENCIA] !== false : true,
    migracion_pendiente: !existe,
  }
}

// PostgREST / Postgres cuando la columna no existe todavía
export function esColumnaInexistente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(error.message?.includes(COLUMNA_AUTOTRANSFERENCIA))
  )
}
