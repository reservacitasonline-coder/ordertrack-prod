// Helper para API Routes: cliente Supabase con service role (acceso total, server-side only)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUser } from '@/types'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        transport: class {
          constructor() {}
          on() {}
          connect() {}
          disconnect() {}
        } as unknown as never,
      },
    }
  )
}

// Helper para devolver errores consistentes
export function errorResponse(message: string, status = 500) {
  return Response.json({ detail: message }, { status })
}

export interface OtAccessRecord {
  id: number
  empresa_id: number
  tecnico_asignado_id: number | null
  estado: string
  [key: string]: unknown
}

// Helper para verificar que una OT existe y pertenece a la empresa del usuario (y técnico asignado si aplica)
export async function verifyOtAccess<T = OtAccessRecord>(
  supabase: SupabaseClient,
  otId: string | number,
  user: CurrentUser,
  options?: { requireAssignedTech?: boolean; columns?: string }
): Promise<{ ot: T | null; error: Response | null }> {
  const columns = options?.columns || 'id, empresa_id, tecnico_asignado_id, estado'
  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select(columns)
    .eq('id', otId)
    .single()

  const ot = data as unknown as T | null

  if (error || !ot) {
    return { ot: null, error: errorResponse('Orden no encontrada', 404) }
  }

  const record = ot as unknown as OtAccessRecord

  if (user.rol !== 'superadmin' && record.empresa_id !== user.empresa_id) {
    return { ot: null, error: errorResponse('Sin permisos sobre esta orden', 403) }
  }

  if (options?.requireAssignedTech && user.rol === 'tecnico' && record.tecnico_asignado_id !== user.id) {
    return { ot: null, error: errorResponse('Esta orden no está asignada a usted', 403) }
  }

  return { ot, error: null }
}

// La función RPC aún no existe en la base (migración sin aplicar): PostgREST
// responde PGRST202 y Postgres 42883. Permite caer al camino anterior.
export function esFuncionInexistente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883'
}

// Normaliza una coordenada enviada por el cliente: número dentro de rango o null.
export function coordenada(valor: unknown, limite: number): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n) || Math.abs(n) > limite) return null
  return n
}
