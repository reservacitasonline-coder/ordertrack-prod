import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'
import { urlDeArchivo } from '@/lib/files'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const EXT_POR_TIPO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const { data, error } = await supabase
    .from('ot_adjuntos')
    .select('*, usuario_subido:usuarios!subido_por(id,nombre), usuarios:usuarios!subido_por(id,nombre,email,rol,empresa_id)')
    .eq('ot_id', id)
    .order('id', { ascending: false })

  if (error) return errorResponse(error.message)

  // URL derivada de la ruta (no se almacena en DB); pasa por /api/archivos, que exige sesión
  const withUrls = (data ?? []).map((adj: Record<string, unknown>) => ({
    ...adj,
    url_publica: urlDeArchivo(adj.ruta as string),
  }))

  return Response.json(withUrls)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return errorResponse('No se recibió archivo', 400)

  if (file.size > MAX_SIZE) return errorResponse('El archivo excede el máximo de 5MB', 400)
  if (!ALLOWED_TYPES.includes(file.type)) return errorResponse(`Tipo ${file.type} no permitido`, 400)

  // La extensión sale del tipo MIME validado, no del nombre que envía el cliente
  const ext = EXT_POR_TIPO[file.type] ?? 'bin'
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `ordenes/${id}/${uniqueName}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from('adjuntos')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadErr) return errorResponse(uploadErr.message)

  const { data, error } = await supabase
    .from('ot_adjuntos')
    .insert({
      ot_id: parseInt(id),
      nombre_archivo: file.name,
      ruta: storagePath,
      tipo_mime: file.type,
      subido_por: user!.id,
    })
    .select('*, usuario_subido:usuarios!subido_por(id,nombre), usuarios:usuarios!subido_por(id,nombre,email,rol,empresa_id)')
    .single()

  if (error) {
    // Revertir upload si falla el INSERT
    await supabase.storage.from('adjuntos').remove([storagePath])
    return errorResponse(error.message)
  }

  const url_publica = urlDeArchivo(storagePath)
  return Response.json({ ...data, url_publica }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const { adjunto_id } = await request.json()
  if (!adjunto_id) return errorResponse('adjunto_id requerido', 400)

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!)
  if (accessErr) return accessErr

  const { data: adjunto, error: fetchErr } = await supabase
    .from('ot_adjuntos')
    .select('ruta')
    .eq('id', adjunto_id)
    .eq('ot_id', id)
    .single()

  if (fetchErr || !adjunto) return errorResponse('Adjunto no encontrado', 404)

  await supabase.storage.from('adjuntos').remove([adjunto.ruta])

  const { error } = await supabase.from('ot_adjuntos').delete().eq('id', adjunto_id)
  if (error) return errorResponse(error.message)

  return new Response(null, { status: 204 })
}
