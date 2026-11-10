// Helper para API Routes: cliente Supabase con service role (acceso total, server-side only)
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Helper para devolver errores consistentes
export function errorResponse(message: string, status = 500) {
  return Response.json({ detail: message }, { status })
}
