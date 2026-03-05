import { nanoid } from 'nanoid'
import type { Session, SessionUser, Restaurant, Vote, ServerMessage } from './types'

export interface SessionState {
  session: Session
  users: SessionUser[]
  restaurants: Restaurant[]
  connections: Map<WebSocket, string> // ws → userId
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

const store = new Map<string, SessionState>()
const SESSION_CLEANUP_DELAY_MS = 30_000

export function createSession(): string {
  const id = nanoid(6).toUpperCase()
  store.set(id, {
    session: { id, locationLat: null, locationLng: null, locationLabel: null },
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
  ws: WebSocket,
  userId: string,
  userName: string
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

export function disconnectSocket(ws: WebSocket): void {
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

export function updateLocation(sessionId: string, lat: number, lng: number, label: string): boolean {
  const state = store.get(sessionId)
  if (!state) return false
  state.session.locationLat = lat
  state.session.locationLng = lng
  state.session.locationLabel = label
  return true
}

export function addRestaurant(
  sessionId: string,
  inputName: string,
  foundName: string,
  address: string,
  lat: number,
  lng: number,
  addedBy: string
): Restaurant | null {
  const state = store.get(sessionId)
  if (!state) return null
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

export function castVote(
  sessionId: string,
  restaurantId: string,
  userId: string,
  score: number
): Vote | null {
  const state = store.get(sessionId)
  if (!state) return null
  const restaurant = state.restaurants.find((r) => r.id === restaurantId)
  if (!restaurant) return null

  const existingIndex = restaurant.votes.findIndex((v) => v.userId === userId)
  const vote: Vote = {
    id: existingIndex >= 0 ? restaurant.votes[existingIndex].id : nanoid(),
    restaurantId,
    userId,
    score,
    votedAt: new Date().toISOString(),
  }
  if (existingIndex >= 0) {
    restaurant.votes[existingIndex] = vote
  } else {
    restaurant.votes.push(vote)
  }
  return vote
}

export function broadcast(state: SessionState, message: ServerMessage, exclude?: WebSocket): void {
  const payload = JSON.stringify(message)
  for (const [ws] of state.connections) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    }
  }
}

export function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
