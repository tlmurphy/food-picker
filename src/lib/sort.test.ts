import { describe, expect, it } from 'vitest'
import type { Restaurant } from '../types'
import { getTopTied, sortRestaurants } from './sort'

function makeRestaurant(id: string, voteUserIds: string[], addedAt = '2024-01-01T00:00:00.000Z'): Restaurant {
  return {
    id,
    sessionId: 'sess',
    inputName: id,
    foundName: id,
    address: null,
    lat: null,
    lng: null,
    addedBy: null,
    addedAt,
    votes: voteUserIds.map((userId, i) => ({
      id: `${id}-v${i}`,
      restaurantId: id,
      userId,
      votedAt: `2024-01-01T0${i}:00:00.000Z`,
    })),
  }
}

describe('sortRestaurants', () => {
  it('returns empty array for empty input', () => {
    expect(sortRestaurants([])).toEqual([])
  })

  it('returns single restaurant unchanged', () => {
    const r = makeRestaurant('a', ['u1'])
    expect(sortRestaurants([r])).toEqual([r])
  })

  it('sorts by vote count descending', () => {
    const low = makeRestaurant('low', ['u1'])
    const high = makeRestaurant('high', ['u1', 'u2', 'u3'])
    const mid = makeRestaurant('mid', ['u1', 'u2'])
    const result = sortRestaurants([low, high, mid])
    expect(result.map((r) => r.id)).toEqual(['high', 'mid', 'low'])
  })

  it('breaks ties by earliest first vote time', () => {
    const early = makeRestaurant('early', ['u1'])
    // Override first vote time to be earlier
    early.votes[0].votedAt = '2024-01-01T01:00:00.000Z'
    const late = makeRestaurant('late', ['u1'])
    late.votes[0].votedAt = '2024-01-01T02:00:00.000Z'
    const result = sortRestaurants([late, early])
    expect(result.map((r) => r.id)).toEqual(['early', 'late'])
  })

  it('breaks ties by addedAt when both have zero votes', () => {
    const first = makeRestaurant('first', [], '2024-01-01T01:00:00.000Z')
    const second = makeRestaurant('second', [], '2024-01-01T02:00:00.000Z')
    const result = sortRestaurants([second, first])
    expect(result.map((r) => r.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const r1 = makeRestaurant('a', ['u1'])
    const r2 = makeRestaurant('b', ['u1', 'u2'])
    const input = [r1, r2]
    sortRestaurants(input)
    expect(input[0].id).toBe('a')
  })
})

describe('getTopTied', () => {
  it('returns empty top and 0 maxVotes when no restaurants have votes', () => {
    const r1 = makeRestaurant('a', [])
    const r2 = makeRestaurant('b', [])
    expect(getTopTied([r1, r2])).toEqual({ top: [], maxVotes: 0 })
  })

  it('returns empty for empty input', () => {
    expect(getTopTied([])).toEqual({ top: [], maxVotes: 0 })
  })

  it('returns single top restaurant when no tie', () => {
    const winner = makeRestaurant('winner', ['u1', 'u2'])
    const loser = makeRestaurant('loser', ['u1'])
    const { top, maxVotes } = getTopTied([winner, loser])
    expect(maxVotes).toBe(2)
    expect(top).toHaveLength(1)
    expect(top[0].id).toBe('winner')
  })

  it('returns all tied restaurants when multiple share max votes', () => {
    const a = makeRestaurant('a', ['u1', 'u2'])
    const b = makeRestaurant('b', ['u1', 'u2'])
    const c = makeRestaurant('c', ['u1'])
    const { top, maxVotes } = getTopTied([a, b, c])
    expect(maxVotes).toBe(2)
    expect(top).toHaveLength(2)
    expect(top.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('excludes zero-vote restaurants from top even if all others have no votes', () => {
    const r = makeRestaurant('r', [])
    const { top, maxVotes } = getTopTied([r])
    expect(top).toHaveLength(0)
    expect(maxVotes).toBe(0)
  })
})
