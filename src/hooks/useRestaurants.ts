import { useState, useEffect } from 'react'
import { socket } from '../lib/socket'
import { sortRestaurants, checkAgreement } from '../lib/sort'
import type { Restaurant } from '../types'

export function useRestaurants(sessionId: string | undefined, userIds: string[]) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [newestId, setNewestId] = useState<string | null>(null)
  const [agreed, setAgreed] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  const userIdsKey = userIds.join(',')

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = socket.subscribe((msg) => {
      switch (msg.type) {
        case 'session_state': {
          const sorted = sortRestaurants(msg.restaurants, userIds)
          setRestaurants(sorted)
          setAgreed(checkAgreement(sorted, userIds))
          setLoading(false)
          break
        }

        case 'restaurant_added': {
          const newRestaurant = msg.restaurant
          setNewestId(newRestaurant.id)
          setRestaurants((prev) => {
            if (prev.some((r) => r.id === newRestaurant.id)) return prev
            const updated = [...prev, newRestaurant]
            const sorted = sortRestaurants(updated, userIds)
            setAgreed(checkAgreement(sorted, userIds))
            return sorted
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
            const sorted = sortRestaurants(updated, userIds)
            setAgreed(checkAgreement(sorted, userIds))
            return sorted
          })
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

  function castVote(restaurantId: string, userId: string, score: number) {
    socket.send({ type: 'cast_vote', restaurantId, userId, score })
  }

  return { restaurants, newestId, agreed, loading, addRestaurant, castVote }
}
