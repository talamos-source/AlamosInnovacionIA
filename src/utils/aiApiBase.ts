/** URL directa de Render — sin Cloudflare intermedio. */
export const RENDER_DIRECT_API = 'https://alamosinnovacionia.onrender.com'

export function getApiBase(): string {
  return (
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
    RENDER_DIRECT_API
  )
}

/**
 * Base URL para llamadas IA pesadas (/ai/*).
 * Si VITE_AI_API_URL está definida, la usa.
 * Si VITE_API_URL apunta a api.alamosinnovacion.com (Cloudflare),
 * bypass automático a Render: Cloudflare devuelve 502/504 sin headers
 * CORS y el browser lo reporta engañosamente como "CORS blocked".
 */
export function getAiApiBase(): string {
  const explicit = (import.meta.env.VITE_AI_API_URL as string | undefined)?.replace(/\/$/, '')
  if (explicit) return explicit
  const apiBase = getApiBase()
  if (apiBase.includes('api.alamosinnovacion.com')) return RENDER_DIRECT_API
  return apiBase
}
