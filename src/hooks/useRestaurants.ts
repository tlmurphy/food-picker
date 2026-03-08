import { useState, useEffect, useRef } from 'react'
import { socket } from '../lib/socket'
import { sortRestaurants } from '../lib/sort'
import type { Restaurant, Elimination } from '../types'

export interface PickResult {
  winnerId: string
  eliminations: Elimination[]
}

interface UseRestaurantsOptions {
  onPickResolved?: (result: PickResult) => void
}

export function useRestaurants(sessionId: string | undefined, options?: UseRestaurantsOptions) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [newestId, setNewestId] = useState<string | null>(null)
  const [pickResult, setPickResult] = useState<PickResult | null>(null)
  const [loading, setLoading] = useState(true)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = socket.subscribe((msg) => {
      switch (msg.type) {
        case 'session_state': {
          const sorted = sortRestaurants(msg.restaurants)
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
            return sortRestaurants(updated)
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
            return sortRestaurants(updated)
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
            return sortRestaurants(updated)
          })
          break
        }

        case 'pick_resolved': {
          const result = { winnerId: msg.winnerId, eliminations: msg.eliminations }
          setPickResult(result)
          optionsRef.current?.onPickResolved?.(result)
          break
        }
      }
    })

    return unsubscribe
  }, [sessionId])

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
