import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '../../../_lib/auth'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ot_adjuntos')
    .select('*, usuario_subido:usuarios!usuario_subido_id(id,nombre)')
    .eq('ot_id', id)
    .order('id', { ascending: false })

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return errorResponse('No se recibió archivo', 400)

  if (file.size > MAX_SIZE) return errorResponse('El archivo excede el máximo de 5MB', 400)
  if (!ALLOWED_TYPES.includes(file.type)) return errorResponse(`Tipo ${file.type} no permitido`, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `ordenes/${id}/${uniqueName}`

  const supabase = createServiceClient()
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from('adjuntos')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadErr) return errorResponse(uploadErr.message)

  const { data: urlData } = supabase.storage.from('adjuntos').getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('ot_adjuntos')
    .insert({
      ot_id: parseInt(id),
      nombre_archivo: file.name,
      ruta: storagePath,
      url_publica: urlData.publicUrl,
      tipo_mime: file.type,
      usuario_subido_id: user!.id,
    })
    .select('*, usuario_subido:usuarios!usuario_subido_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
