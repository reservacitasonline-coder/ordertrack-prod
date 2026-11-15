// Sirve archivos del bucket `adjuntos` solo a usuarios con acceso a la orden.
// Valida sesión + empresa + técnico asignado y redirige a una URL firmada de corta
// duración. Funciona con el bucket público o privado, lo que permite pasarlo a
// privado en Supabase sin romper la aplicación.
import { createServiceClient, errorResponse, verifyOtAccess } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

const BUCKET = 'adjuntos'
const EXPIRA_SEGUNDOS = 300

// Rutas válidas: <carpeta>/<id de OT>/<archivo>
const RUTA_VALIDA = /^(ordenes|checklist|firmas)\/(\d+)\/[^/\\]+$/

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const path = new URL(request.url).searchParams.get('path') ?? ''
  const match = path.match(RUTA_VALIDA)
  if (!match || path.includes('..')) return errorResponse('Ruta de archivo inválida', 400)

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, match[2], user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRA_SEGUNDOS)
  if (error || !data?.signedUrl) return errorResponse('Archivo no encontrado', 404)

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      'Cache-Control': 'private, no-store',
    },
  })
}
