import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Restaurant, ServerMessage, Session, Vote } from '../types'
import { useRestaurants } from './useRestaurants'

// ---------------------------------------------------------------------------
// Mock the socket module so no real WebSocket connection is made
// ---------------------------------------------------------------------------

const { mockSubscribe, mockSend } = vi.hoisted(() => ({
  mockSubscribe: vi.fn<(handler: (msg: ServerMessage) => void) => () => void>(),
  mockSend: vi.fn(),
}))

vi.mock('../lib/socket', () => ({
  socket: {
    subscribe: mockSubscribe,
    send: mockSend,
    connect: vi.fn(),
    subscribeToOpen: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'SESS01'

const mockSession: Session = {
  id: SESSION_ID,
  locationLat: null,
  locationLng: null,
  locationLabel: null,
  locationSetBy: null,
}

function makeRestaurant(id: string, votes: Vote[] = []): Restaurant {
  return {
    id,
    sessionId: SESSION_ID,
    inputName: id,
    foundName: id,
    address: null,
    lat: null,
    lng: null,
    addedBy: null,
    addedAt: '2024-01-01T00:00:00.000Z',
    votes,
  }
}

function makeVote(id: string, restaurantId: string, userId: string, votedAt: string): Vote {
  return { id, restaurantId, userId, votedAt }
}

function captureSubscriber(): (msg: ServerMessage) => void {
  const call = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1]
  if (!call) throw new Error('subscribe was not called')
  return call[0]
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSubscribe.mockImplementation((_handler) => () => {})
  mockSend.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRestaurants', () => {
  it('starts in loading state with empty restaurants', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    expect(result.current.loading).toBe(true)
    expect(result.current.restaurants).toEqual([])
  })

  it('does not subscribe when sessionId is undefined', () => {
    renderHook(() => useRestaurants(undefined))
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('populates restaurants from session_state and clears loading', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()

    const r1 = makeRestaurant('r1', [makeVote('v1', 'r1', 'u1', '2024-01-01T01:00:00.000Z')])
    const r2 = makeRestaurant('r2', [])

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [r2, r1] })
    })

    expect(result.current.loading).toBe(false)
    // r1 has a vote so it sorts first
    expect(result.current.restaurants[0].id).toBe('r1')
    expect(result.current.restaurants[1].id).toBe('r2')
  })

  it('appends a new restaurant on restaurant_added', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [] })
    })
    const newR = makeRestaurant('r1')
    act(() => {
      emit({ type: 'restaurant_added', restaurant: newR })
    })

    expect(result.current.restaurants).toHaveLength(1)
    expect(result.current.restaurants[0].id).toBe('r1')
    expect(result.current.newestId).toBe('r1')
  })

  it('does not add duplicate restaurant on restaurant_added', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()
    const r = makeRestaurant('r1')

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [r] })
    })
    act(() => {
      emit({ type: 'restaurant_added', restaurant: r })
    })

    expect(result.current.restaurants).toHaveLength(1)
  })

  it('adds a vote on vote_cast', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()
    const r = makeRestaurant('r1')

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [r] })
    })
    const vote = makeVote('v1', 'r1', 'u1', '2024-01-01T01:00:00.000Z')
    act(() => {
      emit({ type: 'vote_cast', vote })
    })

    expect(result.current.restaurants[0].votes).toHaveLength(1)
    expect(result.current.restaurants[0].votes[0].id).toBe('v1')
  })

  it('removes a vote on vote_removed', () => {
    const vote = makeVote('v1', 'r1', 'u1', '2024-01-01T01:00:00.000Z')
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({
        type: 'session_state',
        session: mockSession,
        users: [],
        restaurants: [makeRestaurant('r1', [vote])],
      })
    })
    act(() => {
      emit({ type: 'vote_removed', restaurantId: 'r1', userId: 'u1' })
    })

    expect(result.current.restaurants[0].votes).toHaveLength(0)
  })

  it('sets pickResult on pick_resolved and calls onPickResolved callback', () => {
    const onPickResolved = vi.fn()
    const { result } = renderHook(() => useRestaurants(SESSION_ID, { onPickResolved }))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'pick_resolved', winnerId: 'r1', eliminations: [] })
    })

    expect(result.current.pickResult).toEqual({ winnerId: 'r1', eliminations: [] })
    expect(onPickResolved).toHaveBeenCalledWith({ winnerId: 'r1', eliminations: [] })
  })

  it('clearPickResult resets pickResult to null', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'pick_resolved', winnerId: 'r1', eliminations: [] })
    })
    act(() => {
      result.current.clearPickResult()
    })

    expect(result.current.pickResult).toBeNull()
  })

  it('castVote sends cast_vote message via socket', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    act(() => {
      result.current.castVote('r1', 'u1')
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'cast_vote', restaurantId: 'r1', userId: 'u1' })
  })

  it('resolvePick sends resolve_pick message via socket', () => {
    const { result } = renderHook(() => useRestaurants(SESSION_ID))
    act(() => {
      result.current.resolvePick()
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'resolve_pick' })
  })
})
