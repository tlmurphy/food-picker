import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import { checkRateLimit, RATE_LIMIT_WINDOW_MS, rateLimitMap } from './rate-limit'
import { disconnectSocket, getSession } from './session'
import { handleWsMessage } from './ws-handler'

const PORT = Number(process.env.PORT ?? 3001)
const DIST_DIR = join(import.meta.dir, '../dist')
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com'

// Allowed WebSocket origins: Railway domain + localhost for dev
const RAILWAY_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null
const IS_DEV = !RAILWAY_DOMAIN
const ALLOWED_ORIGINS = new Set(
  [RAILWAY_DOMAIN, 'http://localhost:5173', 'http://localhost:3001'].filter(Boolean) as string[],
)

// Periodically evict expired per-IP rate limit entries to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, RATE_LIMIT_WINDOW_MS)

// Maps each WebSocket to the sessionId it belongs to
const wsToSession = new Map<ServerWebSocket<unknown>, string>()

// All open WebSocket connections (for heartbeat pings)
const openConnections = new Set<ServerWebSocket<unknown>>()

// Total open WebSocket connections cap
const MAX_WS_CONNECTIONS = 50
let wsConnectionCount = 0

// Per-connection WS message rate limiter (60 messages/minute)
const wsRateLimit = new WeakMap<ServerWebSocket<unknown>, { count: number; resetAt: number }>()

// Heartbeat: ping all open connections every 20s so idleTimeout doesn't evict live sessions
setInterval(() => {
  for (const ws of openConnections) {
    ws.ping()
  }
}, 20_000)

Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade — validate origin
    if (url.pathname === '/ws') {
      const origin = req.headers.get('origin') ?? ''
      if (!IS_DEV && !ALLOWED_ORIGINS.has(origin)) {
        return new Response('Forbidden', { status: 403 })
      }
      const upgraded = server.upgrade(req)
      if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 })
      return undefined as unknown as Response
    }

    // Google Maps proxy: /api/places/* → https://places.googleapis.com/v1/places/*
    if (url.pathname.startsWith('/api/places')) {
      // Handle CORS preflight (dev proxy sends these)
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 })
      }
      return proxyGoogleMaps(req, url)
    }

    // Google Geocoding proxy: /api/geocode?latlng=lat,lng
    if (url.pathname === '/api/geocode') {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
      return proxyGeocode(req, url)
    }

    // Static file serving (production React build)
    return serveStatic(url.pathname)
  },

  websocket: {
    // Close connections that go silent for 30s (catches silent mobile drops)
    idleTimeout: 30,

    open(ws) {
      if (wsConnectionCount >= MAX_WS_CONNECTIONS) {
        ws.close(1013, 'Server at capacity')
        return
      }
      wsConnectionCount++
      openConnections.add(ws)
      console.log('[ws] connection opened')
    },

    message(ws, rawMessage) {
      handleWsMessage(ws, rawMessage, wsToSession, wsRateLimit)
    },

    close(ws) {
      wsConnectionCount = Math.max(0, wsConnectionCount - 1)
      openConnections.delete(ws)
      console.log('[ws] connection closed')
      wsToSession.delete(ws)
      disconnectSocket(ws)
    },
  },
})

console.log(`Server running on http://localhost:${PORT}`)

async function proxyGoogleMaps(req: Request, url: URL): Promise<Response> {
  // Origin check (same policy as WebSocket) — null origin means same-origin fetch (allowed)
  if (isForbiddenOrigin(req.headers.get('origin'))) {
    return new Response('Forbidden', { status: 403 })
  }

  // Session validation — only active WS session holders may use the proxy
  const sessionId = req.headers.get('x-session-id') ?? ''
  if (!getSession(sessionId.toUpperCase())) {
    return new Response('Forbidden', { status: 403 })
  }

  // Per-IP rate limiting (use last IP in chain — Railway appends real client IP at end)
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  const googlePath = url.pathname.replace('/api/places', '/v1/places')
  const googleUrl = GOOGLE_PLACES_BASE + googlePath + url.search

  let fieldMask: string
  if (url.pathname.includes(':autocomplete')) {
    fieldMask =
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.distanceMeters'
  } else if (url.pathname.includes(':searchText')) {
    fieldMask = 'places.displayName,places.formattedAddress,places.location'
  } else {
    fieldMask = 'location,displayName,formattedAddress'
  }

  const body = req.method !== 'GET' ? await req.text() : undefined
  const upstream = await fetch(googleUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body,
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

async function proxyGeocode(req: Request, url: URL): Promise<Response> {
  if (isForbiddenOrigin(req.headers.get('origin'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const sessionId = req.headers.get('x-session-id') ?? ''
  if (!getSession(sessionId.toUpperCase())) {
    return new Response('Forbidden', { status: 403 })
  }

  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  const latlng = url.searchParams.get('latlng') ?? ''
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(latlng)}&key=${GOOGLE_API_KEY}`
  const upstream = await fetch(geocodeUrl)
  const data: unknown = await upstream.json()
  return new Response(JSON.stringify(data), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isForbiddenOrigin(origin: string | null): boolean {
  return !IS_DEV && origin !== null && !ALLOWED_ORIGINS.has(origin)
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ips = forwarded
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ips[ips.length - 1] ?? '127.0.0.1'
}

async function serveStatic(pathname: string): Promise<Response> {
  const safePath = pathname === '/' ? '/index.html' : pathname
  const isHashed = safePath.startsWith('/assets/')
  const cacheControl = isHashed ? 'public, max-age=31536000, immutable' : 'no-cache'
  try {
    const file = Bun.file(join(DIST_DIR, safePath))
    if (await file.exists()) {
      return new Response(file, { headers: { 'Cache-Control': cacheControl } })
    }
    // SPA fallback
    return new Response(Bun.file(join(DIST_DIR, 'index.html')), {
      headers: { 'Cache-Control': 'no-cache' },
    })
  } catch {
    return new Response(Bun.file(join(DIST_DIR, 'index.html')), {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }
}
