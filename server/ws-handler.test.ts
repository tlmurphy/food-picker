import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerWebSocket } from 'bun'

// Mock the entire session module so no real state is touched
vi.mock('./session')

import * as session from './session'
import { handleWsMessage } from './ws-handler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Ws = ServerWebSocket<unknown>

function mockWs(): Ws {
  return { close: vi.fn() } as unknown as Ws
}

function makeContext() {
  return {
    ws: mockWs(),
    wsToSession: new Map<Ws, string>(),
    wsRateLimit: new WeakMap<Ws, { count: number; resetAt: number }>(),
  }
}

function dispatch(ws: Ws, msg: object, wsToSession: Map<Ws, string>, wsRateLimit: WeakMap<Ws, { count: number; resetAt: number }>) {
  handleWsMessage(ws, JSON.stringify(msg), wsToSession, wsRateLimit)
}

function mockSessionState(id = 'SESS1') {
  return {
    session: { id, locationLat: null, locationLng: null, locationLabel: null, locationSetBy: null },
    users: [],
    restaurants: [],
    connections: new Map(),
    cleanupTimer: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('message validation', () => {
  it('sends error for oversized messages (> 64KB)', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    handleWsMessage(ws, 'x'.repeat(65537), wsToSession, wsRateLimit)
    expect(session.send).toHaveBeenCalledWith(ws, { type: 'error', message: 'Message too large.' })
  })

  it('sends error for invalid JSON', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    handleWsMessage(ws, 'not valid json', wsToSession, wsRateLimit)
    expect(session.send).toHaveBeenCalledWith(ws, { type: 'error', message: 'Invalid message.' })
  })
})

// ---------------------------------------------------------------------------
// Per-connection rate limiting
// ---------------------------------------------------------------------------

describe('per-connection rate limit', () => {
  it('closes the connection after 60 messages in a window', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    vi.mocked(session.createSession).mockReturnValue('SID')

    for (let i = 0; i < 61; i++) {
      handleWsMessage(ws, '{"type":"create_session"}', wsToSession, wsRateLimit)
    }

    expect(ws.close).toHaveBeenCalledWith(1008, 'Rate limit exceeded')
  })

  it('allows exactly 60 messages before closing', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    vi.mocked(session.createSession).mockReturnValue('SID')

    for (let i = 0; i < 60; i++) {
      handleWsMessage(ws, '{"type":"create_session"}', wsToSession, wsRateLimit)
    }

    expect(ws.close).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// create_session
// ---------------------------------------------------------------------------

describe('create_session', () => {
  it('creates a session and sends session_created', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    vi.mocked(session.createSession).mockReturnValue('ABCD1')

    dispatch(ws, { type: 'create_session' }, wsToSession, wsRateLimit)

    expect(session.send).toHaveBeenCalledWith(ws, { type: 'session_created', sessionId: 'ABCD1' })
    expect(wsToSession.get(ws)).toBe('ABCD1')
  })

  it('sends error when server is at capacity', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    vi.mocked(session.createSession).mockReturnValue(null)

    dispatch(ws, { type: 'create_session' }, wsToSession, wsRateLimit)

    expect(session.send).toHaveBeenCalledWith(ws, {
      type: 'error',
      message: 'Server at capacity. Try again later.',
    })
    expect(wsToSession.has(ws)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// join_session
// ---------------------------------------------------------------------------

describe('join_session', () => {
  it('sends session_state on a successful join', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    const state = mockSessionState()
    const user = { id: 'u1', sessionId: 'SESS1', name: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }
    vi.mocked(session.joinSession).mockReturnValue({ state, user, isNew: false })

    dispatch(ws, { type: 'join_session', sessionId: 'SESS1', userId: 'u1', userName: 'Alice' }, wsToSession, wsRateLimit)

    expect(session.send).toHaveBeenCalledWith(ws, {
      type: 'session_state',
      session: state.session,
      users: [],
      restaurants: [],
    })
  })

  it('maps the ws to the (uppercased) sessionId', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    const state = mockSessionState('SESS1')
    const user = { id: 'u1', sessionId: 'SESS1', name: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }
    vi.mocked(session.joinSession).mockReturnValue({ state, user, isNew: false })

    dispatch(ws, { type: 'join_session', sessionId: 'sess1', userId: 'u1', userName: 'Alice' }, wsToSession, wsRateLimit)

    expect(wsToSession.get(ws)).toBe('SESS1')
  })

  it('broadcasts user_joined when the user is new', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    const state = mockSessionState()
    const user = { id: 'u1', sessionId: 'SESS1', name: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }
    vi.mocked(session.joinSession).mockReturnValue({ state, user, isNew: true })

    dispatch(ws, { type: 'join_session', sessionId: 'SESS1', userId: 'u1', userName: 'Alice' }, wsToSession, wsRateLimit)

    expect(session.broadcast).toHaveBeenCalledWith(state, { type: 'user_joined', user }, ws)
  })

  it('does NOT broadcast user_joined for a reconnecting user', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    const state = mockSessionState()
    const user = { id: 'u1', sessionId: 'SESS1', name: 'Alice', joinedAt: '2024-01-01T00:00:00Z' }
    vi.mocked(session.joinSession).mockReturnValue({ state, user, isNew: false })

    dispatch(ws, { type: 'join_session', sessionId: 'SESS1', userId: 'u1', userName: 'Alice' }, wsToSession, wsRateLimit)

    expect(session.broadcast).not.toHaveBeenCalled()
  })

  it('sends error for an unknown session', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    vi.mocked(session.joinSession).mockReturnValue(null)

    dispatch(ws, { type: 'join_session', sessionId: 'NOPE', userId: 'u1', userName: 'Alice' }, wsToSession, wsRateLimit)

    expect(session.send).toHaveBeenCalledWith(ws, {
      type: 'error',
      message: 'Session not found. Check the code and try again.',
    })
  })
})

// ---------------------------------------------------------------------------
// update_location
// ---------------------------------------------------------------------------

describe('update_location', () => {
  it('broadcasts location_updated with valid coordinates', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    const state = mockSessionState()
    vi.mocked(session.getSession).mockReturnValue(state)

    dispatch(ws, { type: 'update_location', lat: 37.7, lng: -122.4, label: 'SF', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.updateLocation).toHaveBeenCalledWith('SESS1', 37.7, -122.4, 'SF', 'u1')
    expect(session.broadcast).toHaveBeenCalledWith(state, {
      type: 'location_updated',
      lat: 37.7,
      lng: -122.4,
      label: 'SF',
      locationSetBy: 'u1',
    })
  })

  it('ignores the message when the ws has no associated session', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()

    dispatch(ws, { type: 'update_location', lat: 37.7, lng: -122.4, label: 'SF', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.updateLocation).not.toHaveBeenCalled()
  })

  it('ignores the message when coordinates are invalid', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')

    dispatch(ws, { type: 'update_location', lat: 999, lng: -122.4, label: 'SF', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.updateLocation).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// add_restaurant
// ---------------------------------------------------------------------------

describe('add_restaurant', () => {
  it('adds the restaurant and broadcasts restaurant_added', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    const restaurant = {
      id: 'r1', sessionId: 'SESS1', inputName: 'Pizza', foundName: 'Pizza Place',
      address: '1 Main St', lat: 37.7, lng: -122.4, addedBy: 'u1',
      addedAt: '2024-01-01T00:00:00Z', votes: [],
    }
    const state = mockSessionState()
    vi.mocked(session.addRestaurant).mockReturnValue(restaurant)
    vi.mocked(session.getSession).mockReturnValue(state)

    dispatch(ws, { type: 'add_restaurant', inputName: 'Pizza', foundName: 'Pizza Place', address: '1 Main St', lat: 37.7, lng: -122.4, addedBy: 'u1' }, wsToSession, wsRateLimit)

    expect(session.broadcast).toHaveBeenCalledWith(state, { type: 'restaurant_added', restaurant })
  })

  it('ignores the message when not in a session', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()

    dispatch(ws, { type: 'add_restaurant', inputName: 'Pizza', foundName: 'Pizza Place', address: '1 Main St', lat: 37.7, lng: -122.4, addedBy: 'u1' }, wsToSession, wsRateLimit)

    expect(session.addRestaurant).not.toHaveBeenCalled()
  })

  it('ignores the message when addRestaurant returns null (e.g. duplicate)', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    vi.mocked(session.addRestaurant).mockReturnValue(null)

    dispatch(ws, { type: 'add_restaurant', inputName: 'Pizza', foundName: 'Pizza Place', address: '1 Main St', lat: 37.7, lng: -122.4, addedBy: 'u1' }, wsToSession, wsRateLimit)

    expect(session.broadcast).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// cast_vote
// ---------------------------------------------------------------------------

describe('cast_vote', () => {
  it('broadcasts vote_cast when a vote is added', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    const vote = { id: 'v1', restaurantId: 'r1', userId: 'u1', votedAt: '2024-01-01T00:00:00Z' }
    const state = mockSessionState()
    vi.mocked(session.toggleVote).mockReturnValue({ action: 'added', vote })
    vi.mocked(session.getSession).mockReturnValue(state)

    dispatch(ws, { type: 'cast_vote', restaurantId: 'r1', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.broadcast).toHaveBeenCalledWith(state, { type: 'vote_cast', vote })
  })

  it('broadcasts vote_removed when a vote is toggled off', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    const state = mockSessionState()
    vi.mocked(session.toggleVote).mockReturnValue({ action: 'removed', restaurantId: 'r1', userId: 'u1' })
    vi.mocked(session.getSession).mockReturnValue(state)

    dispatch(ws, { type: 'cast_vote', restaurantId: 'r1', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.broadcast).toHaveBeenCalledWith(state, { type: 'vote_removed', restaurantId: 'r1', userId: 'u1' })
  })

  it('ignores the message when not in a session', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()

    dispatch(ws, { type: 'cast_vote', restaurantId: 'r1', userId: 'u1' }, wsToSession, wsRateLimit)

    expect(session.toggleVote).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// resolve_pick
// ---------------------------------------------------------------------------

describe('resolve_pick', () => {
  it('broadcasts pick_resolved with winner and eliminations', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    const state = mockSessionState()
    const pickResult = { winnerId: 'r1', eliminations: [] }
    vi.mocked(session.resolvePick).mockReturnValue(pickResult)
    vi.mocked(session.getSession).mockReturnValue(state)

    dispatch(ws, { type: 'resolve_pick' }, wsToSession, wsRateLimit)

    expect(session.broadcast).toHaveBeenCalledWith(state, {
      type: 'pick_resolved',
      winnerId: 'r1',
      eliminations: [],
    })
  })

  it('ignores the message when not in a session', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()

    dispatch(ws, { type: 'resolve_pick' }, wsToSession, wsRateLimit)

    expect(session.resolvePick).not.toHaveBeenCalled()
  })

  it('ignores the message when resolvePick returns null', () => {
    const { ws, wsToSession, wsRateLimit } = makeContext()
    wsToSession.set(ws, 'SESS1')
    vi.mocked(session.resolvePick).mockReturnValue(null)

    dispatch(ws, { type: 'resolve_pick' }, wsToSession, wsRateLimit)

    expect(session.broadcast).not.toHaveBeenCalled()
  })
})
