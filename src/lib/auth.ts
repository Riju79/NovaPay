/**
 * NovaPay Client Authentication Utilities
 * Manages 1AM wallet JWT session tokens, headers, and refresh flows.
 */

export const AUTH_TOKEN_KEY = 'novapay_auth_token'
export const REFRESH_TOKEN_KEY = 'novapay_refresh_token'

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearStoredAuthTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredAuthToken()
  if (!token) return {}
  return {
    Authorization: `Bearer ${token}`,
  }
}
