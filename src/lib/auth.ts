import { RolUsuario, UsuarioResumen } from '@/types';

const ACCESS_TOKEN_KEY = 'ot_access_token';
const REFRESH_TOKEN_KEY = 'ot_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function removeTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface JWTPayload {
  sub?: string; // email
  exp?: number;
  rol?: RolUsuario;
  empresa_id?: number | null;
  nombre?: string;
  id?: number;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  // exp is in seconds, Date.now() in milliseconds
  return decoded.exp * 1000 < Date.now();
}

export function getUserFromToken(): UsuarioResumen | null {
  const token = getAccessToken();
  if (!token) return null;
  const decoded = decodeJWT(token);
  if (!decoded || isTokenExpired(token)) return null;

  return {
    id: decoded.id || 0,
    nombre: decoded.nombre || 'Usuario',
    email: decoded.sub || '',
    rol: decoded.rol || 'tecnico',
    empresa_id: decoded.empresa_id !== undefined ? decoded.empresa_id : null,
  };
}
