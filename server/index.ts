import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import type { ClientMessage } from '../shared/types.ts'
import {
  addRestaurant,
  broadcast,
  createSession,
  disconnectSocket,
  getSession,
  joinSession,
  resolvePick,
  send,
  toggleVote,
  updateLocation,
} from './session'
import { sanitize, validCoords } from './validation'

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

// Per-IP rate limiter for Google Maps proxy (100 req/min per IP)
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
// Global rate limit: 200 req/min total (backstop against IP spoofing)
const GLOBAL_RATE_LIMIT_MAX = 200
let globalRateLimit = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS }

function checkRateLimit(ip: string): boolean {
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

// Periodically evict expired per-IP rate limit entries to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, RATE_LIMIT_WINDOW_MS)

// Maps each WebSocket to the sessionId it belongs to
const wsToSession = new Map<ServerWebSocket<unknown>, string>()

// Total open WebSocket connections cap
const MAX_WS_CONNECTIONS = 50
let wsConnectionCount = 0

// Per-connection WS message rate limiter (60 messages/minute)
const WS_RATE_LIMIT_MAX = 60
const wsRateLimit = new WeakMap<ServerWebSocket<unknown>, { count: number; resetAt: number }>()

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
    open(ws) {
      if (wsConnectionCount >= MAX_WS_CONNECTIONS) {
        ws.close(1013, 'Server at capacity')
        return
      }
      wsConnectionCount++
      console.log('[ws] connection opened')
    },

    message(ws, rawMessage) {
      // Per-connection rate limit
      const now = Date.now()
      const wsLimit = wsRateLimit.get(ws) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
      if (now > wsLimit.resetAt) {
        wsLimit.count = 0
        wsLimit.resetAt = now + RATE_LIMIT_WINDOW_MS
      }
      wsLimit.count++
      wsRateLimit.set(ws, wsLimit)
      if (wsLimit.count > WS_RATE_LIMIT_MAX) {
        ws.close(1008, 'Rate limit exceeded')
        return
      }

      // Reject oversized messages (64KB limit)
      if (typeof rawMessage === 'string' && rawMessage.length > 65536) {
        send(ws, { type: 'error', message: 'Message too large.' })
        return
      }

      let msg: ClientMessage
      try {
        msg = JSON.parse(rawMessage as string) as ClientMessage
      } catch {
        send(ws, { type: 'error', message: 'Invalid message.' })
        return
      }

      const sessionId = wsToSession.get(ws)

      switch (msg.type) {
        case 'create_session': {
          const id = createSession()
          if (!id) {
            send(ws, { type: 'error', message: 'Server at capacity. Try again later.' })
            break
          }
          wsToSession.set(ws, id)
          send(ws, { type: 'session_created', sessionId: id })
          break
        }

        case 'join_session': {
          const cleanSessionId = sanitize(msg.sessionId, 20).toUpperCase()
          const cleanUserId = sanitize(msg.userId, 50)
          const cleanUserName = sanitize(msg.userName, 50)
          const result = joinSession(cleanSessionId, ws, cleanUserId, cleanUserName)
          if (!result) {
            send(ws, { type: 'error', message: 'Session not found. Check the code and try again.' })
            return
          }
          wsToSession.set(ws, cleanSessionId)
          const { state, user, isNew } = result

          send(ws, {
            type: 'session_state',
            session: state.session,
            users: state.users,
            restaurants: state.restaurants,
          })

          if (isNew) {
            broadcast(state, { type: 'user_joined', user }, ws)
          }
          break
        }

        case 'update_location': {
          if (!sessionId) break
          if (!validCoords(msg.lat, msg.lng)) break
          const label = sanitize(msg.label, 200)
          const locationSetBy = sanitize(msg.userId, 50) || null
          updateLocation(sessionId, msg.lat, msg.lng, label, locationSetBy)
          // biome-ignore lint/style/noNonNullAssertion: session existence guaranteed by prior guard
          const state = getSession(sessionId)!
          broadcast(state, { type: 'location_updated', lat: msg.lat, lng: msg.lng, label, locationSetBy })
          break
        }

        case 'add_restaurant': {
          if (!sessionId) break
          if (!validCoords(msg.lat, msg.lng)) break
          const restaurant = addRestaurant(
            sessionId,
            sanitize(msg.inputName, 200),
            sanitize(msg.foundName, 200),
            sanitize(msg.address, 300),
            msg.lat,
            msg.lng,
            sanitize(msg.addedBy, 50),
          )
          if (!restaurant) break
          // biome-ignore lint/style/noNonNullAssertion: session existence guaranteed by prior guard
          const state = getSession(sessionId)!
          broadcast(state, { type: 'restaurant_added', restaurant })
          break
        }

        case 'cast_vote': {
          if (!sessionId) break
          const result = toggleVote(sessionId, sanitize(msg.restaurantId, 50), sanitize(msg.userId, 50))
          if (!result) break
          // biome-ignore lint/style/noNonNullAssertion: session existence guaranteed by prior guard
          const state = getSession(sessionId)!
          if (result.action === 'added') {
            broadcast(state, { type: 'vote_cast', vote: result.vote })
          } else {
            broadcast(state, { type: 'vote_removed', restaurantId: result.restaurantId, userId: result.userId })
          }
          break
        }

        case 'resolve_pick': {
          if (!sessionId) break
          const pickResult = resolvePick(sessionId)
          if (!pickResult) break
          // biome-ignore lint/style/noNonNullAssertion: session existence guaranteed by prior guard
          const state = getSession(sessionId)!
          broadcast(state, {
            type: 'pick_resolved',
            winnerId: pickResult.winnerId,
            eliminations: pickResult.eliminations,
          })
          break
        }
      }
    },

    close(ws) {
      wsConnectionCount = Math.max(0, wsConnectionCount - 1)
      console.log('[ws] connection closed')
      wsToSession.delete(ws)
      disconnectSocket(ws)
    },
  },
})

console.log(`Server running on http://localhost:${PORT}`)

async function proxyGoogleMaps(req: Request, url: URL): Promise<Response> {
  // Origin check (same policy as WebSocket) — null origin means same-origin fetch (allowed)
  const origin = req.headers.get('origin')
  if (!IS_DEV && origin !== null && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Session validation — only active WS session holders may use the proxy
  const sessionId = req.headers.get('x-session-id') ?? ''
  if (!getSession(sessionId.toUpperCase())) {
    return new Response('Forbidden', { status: 403 })
  }

  // Per-IP rate limiting (use last IP in chain — Railway appends real client IP at end)
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ips = forwarded
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ip = ips[ips.length - 1] ?? '127.0.0.1'
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
  const origin = req.headers.get('origin')
  if (!IS_DEV && origin !== null && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 })
  }

  const sessionId = req.headers.get('x-session-id') ?? ''
  if (!getSession(sessionId.toUpperCase())) {
    return new Response('Forbidden', { status: 403 })
  }

  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ips = forwarded
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ip = ips[ips.length - 1] ?? '127.0.0.1'
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
