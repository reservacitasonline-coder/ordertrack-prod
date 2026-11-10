// Cliente HTTP para las API Routes internas de Next.js
// Ya no llama a FastAPI — todo pasa por /api/*

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth: _skip, ...restOptions } = options

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  }

  if (!(restOptions.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  // Las API Routes de Next.js son relativas — /api/ordenes, /api/dashboard, etc.
  const url = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const response = await fetch(url, {
    ...restOptions,
    headers: {
      ...defaultHeaders,
      ...(restOptions.headers as Record<string, string>),
    },
  })

  if (response.status === 401) {
    throw new ApiError(401, 'Sesión expirada')
  }

  if (!response.ok) {
    let errorMessage = 'Ha ocurrido un error inesperado'
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorData.message || errorMessage
    } catch {
      errorMessage = response.statusText || errorMessage
    }
    throw new ApiError(response.status, errorMessage)
  }

  if (response.status === 204) return {} as T

  return response.json() as Promise<T>
}
