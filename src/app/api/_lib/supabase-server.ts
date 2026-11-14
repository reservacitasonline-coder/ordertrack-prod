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

// Helper para verificar que una OT existe y pertenece a la empresa del usuario (y técnico asignado si aplica)
export async function verifyOtAccess(
  supabase: SupabaseClient,
  otId: string | number,
  user: CurrentUser,
  options?: { requireAssignedTech?: boolean }
) {
  const { data: ot, error } = await supabase
    .from('ordenes_trabajo')
    .select('*')
    .eq('id', otId)
    .single()

  if (error || !ot) {
    return { ot: null, error: errorResponse('Orden no encontrada', 404) }
  }

  if (user.rol !== 'superadmin' && ot.empresa_id !== user.empresa_id) {
    return { ot: null, error: errorResponse('Sin permisos sobre esta orden', 403) }
  }

  if (options?.requireAssignedTech && user.rol === 'tecnico' && ot.tecnico_asignado_id !== user.id) {
    return { ot: null, error: errorResponse('Esta orden no está asignada a usted', 403) }
  }

  return { ot, error: null }
}
