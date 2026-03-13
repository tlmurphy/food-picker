import { beforeEach, describe, expect, it, vi } from 'vitest'

// We use vi.resetModules() + dynamic imports so each test gets a fresh in-memory store.
type SessionModule = typeof import('./session')

let mod: SessionModule

beforeEach(async () => {
  vi.resetModules()
  mod = await import('./session')
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshSession() {
  const id = mod.createSession()
  if (!id) throw new Error('createSession returned null unexpectedly')
  return id
}

function addSampleRestaurant(sessionId: string) {
  return mod.addRestaurant(sessionId, 'Input', 'Found Name', '123 Main St', 37.7, -122.4, 'user1')
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe('createSession', () => {
  it('returns a non-null session ID', () => {
    const id = mod.createSession()
    expect(id).not.toBeNull()
    expect(typeof id).toBe('string')
  })

  it('returns null when MAX_SESSIONS (20) is reached', () => {
    for (let i = 0; i < 20; i++) {
      mod.createSession()
    }
    expect(mod.createSession()).toBeNull()
  })

  it('creates a session retrievable via getSession', () => {
    const id = freshSession()
    const state = mod.getSession(id)
    expect(state).toBeDefined()
    expect(state!.session.id).toBe(id)
    expect(state!.restaurants).toEqual([])
    expect(state!.users).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// addRestaurant
// ---------------------------------------------------------------------------

describe('addRestaurant', () => {
  it('adds a restaurant and returns it', () => {
    const id = freshSession()
    const r = addSampleRestaurant(id)
    expect(r).not.toBeNull()
    expect(r!.foundName).toBe('Found Name')
    expect(r!.votes).toEqual([])
    const state = mod.getSession(id)!
    expect(state.restaurants).toHaveLength(1)
  })

  it('returns null for an unknown session', () => {
    expect(mod.addRestaurant('NOPE', 'In', 'Fn', 'Addr', 0, 0, 'u1')).toBeNull()
  })

  it('deduplicates by foundName + address (case-insensitive)', () => {
    const id = freshSession()
    const first = mod.addRestaurant(id, 'In', 'Burger Place', '1 Main St', 0, 0, 'u1')
    const dupe = mod.addRestaurant(id, 'In', 'burger place', '1 MAIN ST', 0, 0, 'u2')
    expect(first).not.toBeNull()
    expect(dupe).toBeNull()
    expect(mod.getSession(id)!.restaurants).toHaveLength(1)
  })

  it('allows same name at different address', () => {
    const id = freshSession()
    mod.addRestaurant(id, 'In', 'Burger Place', '1 Main St', 0, 0, 'u1')
    const r = mod.addRestaurant(id, 'In', 'Burger Place', '2 Other St', 0, 0, 'u1')
    expect(r).not.toBeNull()
    expect(mod.getSession(id)!.restaurants).toHaveLength(2)
  })

  it('returns null when MAX_RESTAURANTS (50) is reached', () => {
    const id = freshSession()
    for (let i = 0; i < 50; i++) {
      mod.addRestaurant(id, `In${i}`, `Place ${i}`, `${i} St`, 0, 0, 'u1')
    }
    const overflow = mod.addRestaurant(id, 'Extra', 'Extra Place', 'Extra St', 0, 0, 'u1')
    expect(overflow).toBeNull()
    expect(mod.getSession(id)!.restaurants).toHaveLength(50)
  })
})

// ---------------------------------------------------------------------------
// toggleVote
// ---------------------------------------------------------------------------

describe('toggleVote', () => {
  it('adds a vote when the user has not voted yet', () => {
    const id = freshSession()
    const r = addSampleRestaurant(id)!
    const result = mod.toggleVote(id, r.id, 'user1')
    expect(result).not.toBeNull()
    expect(result!.action).toBe('added')
    if (result!.action === 'added') {
      expect(result.vote.userId).toBe('user1')
      expect(result.vote.restaurantId).toBe(r.id)
    }
    expect(mod.getSession(id)!.restaurants[0].votes).toHaveLength(1)
  })

  it('removes a vote when the user has already voted', () => {
    const id = freshSession()
    const r = addSampleRestaurant(id)!
    mod.toggleVote(id, r.id, 'user1') // add
    const result = mod.toggleVote(id, r.id, 'user1') // remove
    expect(result).not.toBeNull()
    expect(result!.action).toBe('removed')
    if (result!.action === 'removed') {
      expect(result.userId).toBe('user1')
    }
    expect(mod.getSession(id)!.restaurants[0].votes).toHaveLength(0)
  })

  it('returns null for an unknown session', () => {
    expect(mod.toggleVote('NOPE', 'rid', 'uid')).toBeNull()
  })

  it('returns null for an unknown restaurant', () => {
    const id = freshSession()
    expect(mod.toggleVote(id, 'bad-restaurant-id', 'uid')).toBeNull()
  })

  it('multiple users can each vote independently', () => {
    const id = freshSession()
    const r = addSampleRestaurant(id)!
    mod.toggleVote(id, r.id, 'user1')
    mod.toggleVote(id, r.id, 'user2')
    expect(mod.getSession(id)!.restaurants[0].votes).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// resolvePick
// ---------------------------------------------------------------------------

describe('resolvePick', () => {
  it('returns null for an unknown session', () => {
    expect(mod.resolvePick('NOPE')).toBeNull()
  })

  it('returns null when no restaurant has votes', () => {
    const id = freshSession()
    addSampleRestaurant(id)
    expect(mod.resolvePick(id)).toBeNull()
  })

  it('returns the single winner with no eliminations when there is no tie', () => {
    const id = freshSession()
    const r1 = addSampleRestaurant(id)!
    const r2 = mod.addRestaurant(id, 'In2', 'Place 2', '2 St', 0, 0, 'u1')!
    mod.toggleVote(id, r1.id, 'user1')
    mod.toggleVote(id, r1.id, 'user2')
    mod.toggleVote(id, r2.id, 'user1')

    const result = mod.resolvePick(id)
    expect(result).not.toBeNull()
    expect(result!.winnerId).toBe(r1.id)
    expect(result!.eliminations).toHaveLength(0)
  })

  it('returns eliminations when there is a tie', () => {
    const id = freshSession()
    const r1 = addSampleRestaurant(id)!
    const r2 = mod.addRestaurant(id, 'In2', 'Place 2', '2 St', 0, 0, 'u1')!
    mod.toggleVote(id, r1.id, 'user1')
    mod.toggleVote(id, r2.id, 'user1')

    const result = mod.resolvePick(id)
    expect(result).not.toBeNull()
    expect(result!.eliminations).toHaveLength(1)
    expect([r1.id, r2.id]).toContain(result!.winnerId)
    const elim = result!.eliminations[0]
    expect(elim.round).toBe(1)
    expect([r1.id, r2.id]).toContain(elim.winnerId)
  })

  it('winner is one of the top-tied restaurants', () => {
    const id = freshSession()
    const tied = [
      addSampleRestaurant(id)!,
      mod.addRestaurant(id, 'In2', 'Place 2', '2 St', 0, 0, 'u1')!,
      mod.addRestaurant(id, 'In3', 'Place 3', '3 St', 0, 0, 'u1')!,
    ]
    const loserId = mod.addRestaurant(id, 'In4', 'Loser', '4 St', 0, 0, 'u1')!.id

    for (const r of tied) {
      mod.toggleVote(id, r.id, 'user1')
      mod.toggleVote(id, r.id, 'user2')
    }
    mod.toggleVote(id, loserId, 'user1')

    const result = mod.resolvePick(id)
    expect(result).not.toBeNull()
    const tiedIds = tied.map((r) => r.id)
    expect(tiedIds).toContain(result!.winnerId)
  })
})
