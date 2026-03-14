export const RATE_LIMIT_MAX = 100
export const RATE_LIMIT_WINDOW_MS = 60_000
export const GLOBAL_RATE_LIMIT_MAX = 200

export const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
export let globalRateLimit = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS }

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  // Reset global window if expired
  if (now > globalRateLimit.resetAt) {
    globalRateLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }
  if (globalRateLimit.count >= GLOBAL_RATE_LIMIT_MAX) return false
  // Per-IP check (use last IP in chain — Railway appends real client IP at end)
  const entry = rateLimitMap.get(ip)
  if (entry && now <= entry.resetAt && entry.count >= RATE_LIMIT_MAX) return false
  // Both limits pass — increment
  globalRateLimit.count++
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count++
  }
  return true
}
