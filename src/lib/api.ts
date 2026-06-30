import { getAccessToken, getRefreshToken, setTokens, removeTokens, isTokenExpired } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ordertrack.quipubookstore.com/api/v1';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

// Global flag to prevent concurrent refresh requests
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function handleTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    removeTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?expired=true';
    }
    return null;
  }
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth = false, headers = {}, ...restOptions } = options;

  let token = getAccessToken();

  // If token is expired and we are not on the login page or refreshing, attempt a refresh before calling
  if (!skipAuth && token && isTokenExpired(token)) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await handleTokenRefresh();
      isRefreshing = false;
      if (newToken) {
        token = newToken;
        onRefreshed(newToken);
      }
    } else {
      // Wait for the active refresh to finish
      token = await new Promise<string>((resolve) => {
        subscribeTokenRefresh((newToken) => resolve(newToken));
      });
    }
  }

  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Do not set Content-Type header if body is FormData (e.g. for uploads)
  if (!(restOptions.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth && token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    });

    if (response.status === 401 && !skipAuth) {
      // Token might have been revoked on the server. Try refreshing.
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await handleTokenRefresh();
        isRefreshing = false;
        if (newToken) {
          // Retry the request once
          return apiFetch<T>(endpoint, {
            ...options,
            headers: {
              ...headers,
              'Authorization': `Bearer ${newToken}`,
            },
          });
        }
      } else {
        // Wait for the active refresh to finish
        const newToken = await new Promise<string>((resolve) => {
          subscribeTokenRefresh((t) => resolve(t));
        });
        return apiFetch<T>(endpoint, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          },
        });
      }
      
      removeTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Sesión expirada');
    }

    if (!response.ok) {
      let errorMessage = 'Ha ocurrido un error inesperado';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Fallback to text status
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiError(response.status, errorMessage);
    }

    // Handle 204 No Content or empty bodies
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or other runtime fetch errors
    throw new ApiError(500, error instanceof Error ? error.message : 'Error de conexión');
  }
}
