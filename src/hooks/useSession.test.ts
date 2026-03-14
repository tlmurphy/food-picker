import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerMessage, Session, SessionUser } from '../types'
import { useSession } from './useSession'

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

const mockUser: SessionUser = { id: 'u1', name: 'Alice', sessionId: SESSION_ID, joinedAt: '2024-01-01T00:00:00.000Z' }

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

describe('useSession', () => {
  it('starts in loading state with null session and empty users', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    expect(result.current.loading).toBe(true)
    expect(result.current.session).toBeNull()
    expect(result.current.users).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('does not subscribe when sessionId is undefined', () => {
    renderHook(() => useSession(undefined))
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('populates session and users from session_state and clears loading', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [mockUser], restaurants: [] })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.session).toEqual(mockSession)
    expect(result.current.users).toEqual([mockUser])
  })

  it('sets error and clears loading on error message', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'error', message: 'Session not found' })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Session not found')
  })

  it('appends a new user on user_joined', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [mockUser], restaurants: [] })
    })
    const newUser: SessionUser = { id: 'u2', name: 'Bob', sessionId: SESSION_ID, joinedAt: '2024-01-01T00:00:00.000Z' }
    act(() => {
      emit({ type: 'user_joined', user: newUser })
    })

    expect(result.current.users).toHaveLength(2)
    expect(result.current.users[1]).toEqual(newUser)
  })

  it('does not duplicate a user on user_joined if already present', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [mockUser], restaurants: [] })
    })
    act(() => {
      emit({ type: 'user_joined', user: mockUser })
    })

    expect(result.current.users).toHaveLength(1)
  })

  it('updates session location on location_updated', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [] })
    })
    act(() => {
      emit({ type: 'location_updated', lat: 37.7, lng: -122.4, label: 'San Francisco', locationSetBy: 'u1' })
    })

    expect(result.current.session?.locationLat).toBe(37.7)
    expect(result.current.session?.locationLng).toBe(-122.4)
    expect(result.current.session?.locationLabel).toBe('San Francisco')
    expect(result.current.session?.locationSetBy).toBe('u1')
  })

  it('ignores location_updated when session is null', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'location_updated', lat: 37.7, lng: -122.4, label: 'SF', locationSetBy: 'u1' })
    })

    expect(result.current.session).toBeNull()
  })

  it('updateLocation sends update_location message and optimistically updates session', () => {
    const { result } = renderHook(() => useSession(SESSION_ID))
    const emit = captureSubscriber()

    act(() => {
      emit({ type: 'session_state', session: mockSession, users: [], restaurants: [] })
    })
    act(() => {
      result.current.updateLocation(40.7, -74.0, 'New York', 'u1')
    })

    expect(mockSend).toHaveBeenCalledWith({
      type: 'update_location',
      lat: 40.7,
      lng: -74.0,
      label: 'New York',
      userId: 'u1',
    })
    expect(result.current.session?.locationLat).toBe(40.7)
    expect(result.current.session?.locationLng).toBe(-74.0)
    expect(result.current.session?.locationLabel).toBe('New York')
  })

  it('updateLocation does nothing when sessionId is undefined', () => {
    const { result } = renderHook(() => useSession(undefined))
    act(() => {
      result.current.updateLocation(40.7, -74.0, 'New York', 'u1')
    })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
