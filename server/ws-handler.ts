import type { ServerWebSocket } from 'bun'
import type { ClientMessage } from '../shared/types.ts'
import { RATE_LIMIT_WINDOW_MS } from './rate-limit'
import {
  addRestaurant,
  broadcast,
  createSession,
  getSession,
  joinSession,
  resolvePick,
  send,
  toggleVote,
  updateLocation,
} from './session'
import { sanitize, validCoords } from './validation'

type Ws = ServerWebSocket<unknown>

// Per-connection WS message rate limiter (60 messages/minute)
const WS_RATE_LIMIT_MAX = 60

export function handleWsMessage(
  ws: Ws,
  rawMessage: string | Buffer,
  wsToSession: Map<Ws, string>,
  wsRateLimit: WeakMap<Ws, { count: number; resetAt: number }>,
): void {
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
}
