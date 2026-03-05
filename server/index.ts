import { join } from 'path'
import type { ServerWebSocket } from 'bun'
import type { ClientMessage } from './types'
import {
  createSession,
  getSession,
  joinSession,
  disconnectSocket,
  updateLocation,
  addRestaurant,
  castVote,
  broadcast,
  send,
} from './session'

const PORT = Number(process.env.PORT ?? 3001)
const DIST_DIR = join(import.meta.dir, '../dist')
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com'

// Maps each WebSocket to the sessionId it belongs to
const wsToSession = new Map<ServerWebSocket<unknown>, string>()

Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req)
      if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 })
      return undefined as unknown as Response
    }

    // Google Maps proxy: /api/places/* → https://places.googleapis.com/v1/places/*
    if (url.pathname.startsWith('/api/places')) {
      return proxyGoogleMaps(req, url)
    }

    // Static file serving (production React build)
    return serveStatic(url.pathname)
  },

  websocket: {
    open(ws) {
      console.log('[ws] connection opened')
    },

    message(ws, rawMessage) {
      let msg: ClientMessage
      try {
        msg = JSON.parse(rawMessage as string) as ClientMessage
      } catch {
        send(ws as unknown as WebSocket, { type: 'error', message: 'Invalid message.' })
        return
      }

      const sessionId = wsToSession.get(ws)

      switch (msg.type) {
        case 'create_session': {
          const id = createSession()
          wsToSession.set(ws, id)
          send(ws as unknown as WebSocket, { type: 'session_created', sessionId: id })
          break
        }

        case 'join_session': {
          const result = joinSession(msg.sessionId, ws as unknown as WebSocket, msg.userId, msg.userName)
          if (!result) {
            send(ws as unknown as WebSocket, { type: 'error', message: 'Session not found. Check the code and try again.' })
            return
          }
          wsToSession.set(ws, msg.sessionId)
          const { state, user, isNew } = result

          send(ws as unknown as WebSocket, {
            type: 'session_state',
            session: state.session,
            users: state.users,
            restaurants: state.restaurants,
          })

          if (isNew) {
            broadcast(state, { type: 'user_joined', user }, ws as unknown as WebSocket)
          }
          break
        }

        case 'update_location': {
          if (!sessionId) break
          updateLocation(sessionId, msg.lat, msg.lng, msg.label)
          const state = getSession(sessionId)!
          broadcast(state, { type: 'location_updated', lat: msg.lat, lng: msg.lng, label: msg.label })
          break
        }

        case 'add_restaurant': {
          if (!sessionId) break
          const restaurant = addRestaurant(sessionId, msg.inputName, msg.foundName, msg.address, msg.lat, msg.lng, msg.addedBy)
          if (!restaurant) break
          const state = getSession(sessionId)!
          broadcast(state, { type: 'restaurant_added', restaurant })
          break
        }

        case 'cast_vote': {
          if (!sessionId) break
          const vote = castVote(sessionId, msg.restaurantId, msg.userId, msg.score)
          if (!vote) break
          const state = getSession(sessionId)!
          broadcast(state, { type: 'vote_cast', vote })
          break
        }
      }
    },

    close(ws) {
      console.log('[ws] connection closed')
      wsToSession.delete(ws)
      disconnectSocket(ws as unknown as WebSocket)
    },
  },
})

console.log(`Server running on http://localhost:${PORT}`)

async function proxyGoogleMaps(req: Request, url: URL): Promise<Response> {
  const googlePath = url.pathname.replace('/api/places', '/v1/places')
  const googleUrl = GOOGLE_PLACES_BASE + googlePath + url.search

  let fieldMask = 'location,displayName,formattedAddress'
  if (url.pathname.includes(':autocomplete')) {
    fieldMask = 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.distanceMeters'
  } else if (url.pathname.includes(':searchText')) {
    fieldMask = 'places.displayName,places.formattedAddress,places.location'
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
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function serveStatic(pathname: string): Promise<Response> {
  const safePath = pathname === '/' ? '/index.html' : pathname
  try {
    const file = Bun.file(join(DIST_DIR, safePath))
    if (await file.exists()) {
      return new Response(file)
    }
    // SPA fallback
    return new Response(Bun.file(join(DIST_DIR, 'index.html')))
  } catch {
    return new Response(Bun.file(join(DIST_DIR, 'index.html')))
  }
}
