import type { ServerWebSocket } from 'bun'
import { nanoid } from 'nanoid'
import type { Elimination, Restaurant, ServerMessage, Session, SessionUser, Vote } from '../shared/types.ts'

type Socket = ServerWebSocket<unknown>

export interface SessionState {
  session: Session
  users: SessionUser[]
  restaurants: Restaurant[]
  connections: Map<Socket, string> // ws → userId
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

const store = new Map<string, SessionState>()
const SESSION_CLEANUP_DELAY_MS = 60_000

const MAX_SESSIONS = 20

export function createSession(): string | null {
  if (store.size >= MAX_SESSIONS) return null
  const id = nanoid(10).toUpperCase()
  store.set(id, {
    session: { id, locationLat: null, locationLng: null, locationLabel: null, locationSetBy: null },
    users: [],
    restaurants: [],
    connections: new Map(),
    cleanupTimer: null,
  })
  return id
}

export function getSession(id: string): SessionState | undefined {
  return store.get(id)
}

export function joinSession(
  sessionId: string,
  ws: Socket,
  userId: string,
  userName: string,
): { state: SessionState; user: SessionUser; isNew: boolean } | null {
  const state = store.get(sessionId)
  if (!state) return null

  // Cancel any pending cleanup — someone rejoined
  if (state.cleanupTimer) {
    clearTimeout(state.cleanupTimer)
    state.cleanupTimer = null
  }

  // Reconnect path: reuse existing user record
  const existing = userId ? state.users.find((u) => u.id === userId) : undefined
  if (existing) {
    state.connections.set(ws, existing.id)
    return { state, user: existing, isNew: false }
  }

  // Enforce user limit
  if (state.users.length >= 20) return null

  // New user
  const user: SessionUser = {
    id: nanoid(),
    sessionId,
    name: userName,
    joinedAt: new Date().toISOString(),
  }
  state.users.push(user)
  state.connections.set(ws, user.id)
  return { state, user, isNew: true }
}

export function disconnectSocket(ws: Socket): void {
  for (const [sessionId, state] of store.entries()) {
    if (!state.connections.has(ws)) continue
    state.connections.delete(ws)
    if (state.connections.size === 0) {
      state.cleanupTimer = setTimeout(() => {
        store.delete(sessionId)
        console.log(`[session] cleaned up empty session ${sessionId}`)
      }, SESSION_CLEANUP_DELAY_MS)
    }
    break
  }
}

export function updateLocation(
  sessionId: string,
  lat: number,
  lng: number,
  label: string,
  locationSetBy: string | null,
): boolean {
  const state = store.get(sessionId)
  if (!state) return false
  state.session.locationLat = lat
  state.session.locationLng = lng
  state.session.locationLabel = label
  state.session.locationSetBy = locationSetBy
  return true
}

export function addRestaurant(
  sessionId: string,
  inputName: string,
  foundName: string,
  address: string,
  lat: number,
  lng: number,
  addedBy: string,
): Restaurant | null {
  const state = store.get(sessionId)
  if (!state) return null
  if (state.restaurants.length >= 50) return null
  const isDuplicate = state.restaurants.some(
    (r) => r.foundName?.toLowerCase() === foundName.toLowerCase() && r.address?.toLowerCase() === address.toLowerCase(),
  )
  if (isDuplicate) return null
  const restaurant: Restaurant = {
    id: nanoid(),
    sessionId,
    inputName,
    foundName,
    address,
    lat,
    lng,
    addedBy,
    addedAt: new Date().toISOString(),
    votes: [],
  }
  state.restaurants.push(restaurant)
  return restaurant
}

export function toggleVote(
  sessionId: string,
  restaurantId: string,
  userId: string,
): { action: 'added'; vote: Vote } | { action: 'removed'; restaurantId: string; userId: string } | null {
  const state = store.get(sessionId)
  if (!state) return null
  const restaurant = state.restaurants.find((r) => r.id === restaurantId)
  if (!restaurant) return null

  const existingIndex = restaurant.votes.findIndex((v) => v.userId === userId)
  if (existingIndex >= 0) {
    restaurant.votes.splice(existingIndex, 1)
    return { action: 'removed', restaurantId, userId }
  }

  const vote: Vote = {
    id: nanoid(),
    restaurantId,
    userId,
    votedAt: new Date().toISOString(),
  }
  restaurant.votes.push(vote)
  return { action: 'added', vote }
}

export function resolvePick(sessionId: string): { winnerId: string; eliminations: Elimination[] } | null {
  const state = store.get(sessionId)
  if (!state) return null

  const withVotes = state.restaurants.filter((r) => r.votes.length > 0)
  if (withVotes.length === 0) return null

  const maxVotes = Math.max(...withVotes.map((r) => r.votes.length))
  const topTied = withVotes.filter((r) => r.votes.length === maxVotes)

  if (topTied.length === 1) {
    return { winnerId: topTied[0].id, eliminations: [] }
  }

  // Coin flip elimination bracket
  const eliminations: Elimination[] = []
  let remaining = [...topTied]
  let round = 1

  while (remaining.length > 1) {
    const nextRound: Restaurant[] = []
    for (let i = 0; i < remaining.length; i += 2) {
      if (i + 1 >= remaining.length) {
        // Odd one out gets a bye
        nextRound.push(remaining[i])
        continue
      }
      const r1 = remaining[i]
      const r2 = remaining[i + 1]
      const randomBytes = new Uint32Array(1)
      crypto.getRandomValues(randomBytes)
      const winner = randomBytes[0] % 2 === 0 ? r1 : r2
      eliminations.push({
        round,
        restaurant1: r1.id,
        restaurant2: r2.id,
        winnerId: winner.id,
      })
      nextRound.push(winner)
    }
    remaining = nextRound
    round++
  }

  return { winnerId: remaining[0].id, eliminations }
}

export function broadcast(state: SessionState, message: ServerMessage, exclude?: Socket): void {
  const payload = JSON.stringify(message)
  for (const [ws] of state.connections) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    }
  }
}

export function send(ws: Socket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
