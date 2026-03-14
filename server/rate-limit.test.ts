import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.resetModules() + dynamic re-import gives each test a fresh in-memory state.
type RateLimitModule = typeof import('./rate-limit')
let mod: RateLimitModule

beforeEach(async () => {
  vi.resetModules()
  mod = await import('./rate-limit')
})

describe('checkRateLimit', () => {
  it('allows a first request from any IP', () => {
    expect(mod.checkRateLimit('1.2.3.4')).toBe(true)
  })

  it('increments the per-IP counter', () => {
    mod.checkRateLimit('1.2.3.4')
    mod.checkRateLimit('1.2.3.4')
    const entry = mod.rateLimitMap.get('1.2.3.4')
    expect(entry?.count).toBe(2)
  })

  it('blocks the request after per-IP limit (100) is reached', () => {
    for (let i = 0; i < 100; i++) {
      mod.checkRateLimit('1.2.3.4')
    }
    expect(mod.checkRateLimit('1.2.3.4')).toBe(false)
  })

  it('allows exactly 100 requests before blocking the 101st', () => {
    let allowed = 0
    for (let i = 0; i < 101; i++) {
      if (mod.checkRateLimit('1.2.3.4')) allowed++
    }
    expect(allowed).toBe(100)
  })

  it('per-IP limits are independent across different IPs', () => {
    for (let i = 0; i < 100; i++) {
      mod.checkRateLimit('1.2.3.4')
    }
    // IP A is blocked, but IP B is not
    expect(mod.checkRateLimit('1.2.3.4')).toBe(false)
    expect(mod.checkRateLimit('9.9.9.9')).toBe(true)
  })

  it('blocks once the global limit (200) is exhausted', () => {
    // Use 200 unique IPs (each gets 1 request) to hit the global cap
    for (let i = 0; i < 200; i++) {
      mod.checkRateLimit(`10.0.${Math.floor(i / 256)}.${i % 256}`)
    }
    expect(mod.checkRateLimit('new-ip')).toBe(false)
  })

  it('allows exactly 200 requests before the global limit kicks in', () => {
    let allowed = 0
    for (let i = 0; i < 201; i++) {
      if (mod.checkRateLimit(`unique-ip-${i}`)) allowed++
    }
    expect(allowed).toBe(200)
  })

  it('resets the per-IP counter after the rate limit window expires', () => {
    vi.useFakeTimers()

    for (let i = 0; i < 100; i++) {
      mod.checkRateLimit('1.2.3.4')
    }
    expect(mod.checkRateLimit('1.2.3.4')).toBe(false)

    // Advance past the 60-second window
    vi.advanceTimersByTime(mod.RATE_LIMIT_WINDOW_MS + 1)

    expect(mod.checkRateLimit('1.2.3.4')).toBe(true)
    vi.useRealTimers()
  })

  it('resets the global counter after the rate limit window expires', () => {
    vi.useFakeTimers()

    for (let i = 0; i < 200; i++) {
      mod.checkRateLimit(`unique-ip-${i}`)
    }
    expect(mod.checkRateLimit('new-ip')).toBe(false)

    vi.advanceTimersByTime(mod.RATE_LIMIT_WINDOW_MS + 1)

    expect(mod.checkRateLimit('new-ip')).toBe(true)
    vi.useRealTimers()
  })

  it('uses the provided IP string as the map key', () => {
    mod.checkRateLimit('192.168.1.1')
    expect(mod.rateLimitMap.has('192.168.1.1')).toBe(true)
  })
})
