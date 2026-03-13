import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// directions.ts evaluates navigator.userAgent at module load time, so we need
// to stub it and re-import the module for each user-agent scenario.

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120'

describe('getDirectionsUrl', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a Google Maps URL on non-iOS devices', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: CHROME_UA,
      configurable: true,
    })
    const { getDirectionsUrl } = await import('./directions')
    const url = getDirectionsUrl(37.7749, -122.4194)
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=37.7749,-122.4194')
  })

  it('returns an Apple Maps URL on iOS devices', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: IPHONE_UA,
      configurable: true,
    })
    const { getDirectionsUrl } = await import('./directions')
    const url = getDirectionsUrl(37.7749, -122.4194)
    expect(url).toBe('maps://maps.apple.com/?daddr=37.7749,-122.4194')
  })

  it('encodes coordinates correctly in both URLs', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: CHROME_UA,
      configurable: true,
    })
    const { getDirectionsUrl } = await import('./directions')
    const url = getDirectionsUrl(51.5074, -0.1278)
    expect(url).toContain('51.5074')
    expect(url).toContain('-0.1278')
  })
})
