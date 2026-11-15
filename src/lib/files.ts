// URLs de archivos de órdenes (adjuntos, fotos de checklist, firmas).
// Los archivos se sirven por /api/archivos, que valida la sesión y el acceso a la
// orden antes de entregar una URL firmada. Nunca construir URLs públicas del bucket.

const PREFIJO_PUBLICO = '/storage/v1/object/public/adjuntos/'
const RUTA_PROXY = '/api/archivos'

// Extrae la ruta dentro del bucket desde cualquier forma en que se haya guardado:
// ruta relativa, URL pública antigua de Supabase o URL del proxy.
export function rutaDeArchivo(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.trim()
  if (!v || v.startsWith('data:') || v.startsWith('blob:')) return null

  const idx = v.indexOf(PREFIJO_PUBLICO)
  if (idx >= 0) {
    return decodeURIComponent(v.slice(idx + PREFIJO_PUBLICO.length).split('?')[0])
  }
  if (v.startsWith(RUTA_PROXY)) {
    const query = v.split('?')[1] ?? ''
    return new URLSearchParams(query).get('path')
  }
  if (v.startsWith('http://') || v.startsWith('https://')) return null
  return v.replace(/^\/+/, '')
}

// URL que el navegador puede usar en <img> o <a>.
export function urlDeArchivo(valor: string | null | undefined): string {
  if (!valor) return ''
  const ruta = rutaDeArchivo(valor)
  if (!ruta) return valor // data:, blob: o URL externa: se deja tal cual
  return `${RUTA_PROXY}?path=${encodeURIComponent(ruta)}`
}
