import { createServiceClient, errorResponse, verifyOtAccess } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['tecnico', 'admin', 'operador', 'superadmin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return errorResponse('No se recibió archivo', 400)
  if (file.size > MAX_SIZE) return errorResponse('La imagen excede el máximo de 10MB', 400)
  if (!ALLOWED_TYPES.includes(file.type)) return errorResponse(`Tipo ${file.type} no permitido`, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const storagePath = `checklist/${id}/${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from('adjuntos')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadErr) return errorResponse(uploadErr.message)

  const { data: { publicUrl } } = supabase.storage.from('adjuntos').getPublicUrl(storagePath)

  return Response.json({ ruta: storagePath, url: publicUrl }, { status: 201 })
}
