import { useState, useEffect } from 'react'
import { socket } from '../lib/socket'
import { sortRestaurants } from '../lib/sort'
import type { Restaurant, Elimination } from '../types'

export interface PickResult {
  winnerId: string
  eliminations: Elimination[]
}

export function useRestaurants(sessionId: string | undefined, userIds: string[]) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [newestId, setNewestId] = useState<string | null>(null)
  const [pickResult, setPickResult] = useState<PickResult | null>(null)
  const [loading, setLoading] = useState(true)

  const userIdsKey = userIds.join(',')

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = socket.subscribe((msg) => {
      switch (msg.type) {
        case 'session_state': {
          const sorted = sortRestaurants(msg.restaurants, userIds)
          setRestaurants(sorted)
          setLoading(false)
          break
        }

        case 'restaurant_added': {
          const newRestaurant = msg.restaurant
          setNewestId(newRestaurant.id)
          setRestaurants((prev) => {
            if (prev.some((r) => r.id === newRestaurant.id)) return prev
            const updated = [...prev, newRestaurant]
            return sortRestaurants(updated, userIds)
          })
          break
        }

        case 'vote_cast': {
          const vote = msg.vote
          setRestaurants((prev) => {
            const updated = prev.map((r) => {
              if (r.id !== vote.restaurantId) return r
              const filteredVotes = r.votes.filter((v) => v.id !== vote.id)
              return { ...r, votes: [...filteredVotes, vote] }
            })
            return sortRestaurants(updated, userIds)
          })
          break
        }

        case 'vote_removed': {
          const { restaurantId, userId } = msg
          setRestaurants((prev) => {
            const updated = prev.map((r) => {
              if (r.id !== restaurantId) return r
              return { ...r, votes: r.votes.filter((v) => v.userId !== userId) }
            })
            return sortRestaurants(updated, userIds)
          })
          break
        }

        case 'pick_resolved': {
          setPickResult({ winnerId: msg.winnerId, eliminations: msg.eliminations })
          break
        }
      }
    })

    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userIdsKey])

  function addRestaurant(
    inputName: string,
    foundName: string,
    address: string,
    lat: number,
    lng: number,
    addedBy: string
  ) {
    socket.send({ type: 'add_restaurant', inputName, foundName, address, lat, lng, addedBy })
  }

  function castVote(restaurantId: string, userId: string) {
    socket.send({ type: 'cast_vote', restaurantId, userId })
  }

  function resolvePick() {
    socket.send({ type: 'resolve_pick' })
  }

  function clearPickResult() {
    setPickResult(null)
  }

  return { restaurants, newestId, pickResult, loading, addRestaurant, castVote, resolvePick, clearPickResult }
}
