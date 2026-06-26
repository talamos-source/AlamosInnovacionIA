/** URL directa de Render — sin Cloudflare intermedio. */
export const RENDER_DIRECT_API = 'https://alamosinnovacionia.onrender.com'

export function getApiBase(): string {
  return (
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
    RENDER_DIRECT_API
  )
}

function isAlamosProductionHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return (
    h === 'privado.alamosinnovacion.com' ||
    h === 'www.alamosinnovacion.com' ||
    h === 'alamosinnovacion.com' ||
    h.endsWith('.alamosinnovacion.com')
  )
}

/**
 * Base URL para llamadas IA pesadas (/ai/*).
 * En privado.alamosinnovacion.com SIEMPRE usa Render directo: Cloudflare
 * en api.alamosinnovacion.com devuelve 502 sin CORS headers.
 */
export function getAiApiBase(): string {
  if (isAlamosProductionHost()) return RENDER_DIRECT_API

  const explicit = (import.meta.env.VITE_AI_API_URL as string | undefined)?.replace(/\/$/, '')
  if (explicit && !explicit.includes('api.alamosinnovacion.com')) return explicit

  const apiBase = getApiBase()
  if (apiBase.includes('api.alamosinnovacion.com')) return RENDER_DIRECT_API
  return apiBase
}
