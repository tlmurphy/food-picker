import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sortRestaurants, checkAgreement } from '../lib/sort'
import type { Restaurant, Vote, RestaurantWithVotes } from '../types'

export function useRestaurants(sessionId: string | undefined, userIds: string[]) {
  const [restaurants, setRestaurants] = useState<RestaurantWithVotes[]>([])
  const [newestId, setNewestId] = useState<string | null>(null)
  const [agreed, setAgreed] = useState<RestaurantWithVotes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    let mounted = true

    async function load() {
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('session_id', sessionId!)
        .order('added_at')

      const restaurantIds = (restaurantData ?? []).map((r) => r.id)

      const { data: voteData } = restaurantIds.length > 0
        ? await supabase.from('votes').select('*').in('restaurant_id', restaurantIds)
        : { data: [] }

      if (!mounted) return

      const withVotes = mergeVotes(restaurantData ?? [], voteData ?? [])
      const sorted = sortRestaurants(withVotes, userIds)
      setRestaurants(sorted)
      setAgreed(checkAgreement(sorted, userIds))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`restaurants-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'restaurants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!mounted) return
          const newRestaurant = payload.new as Restaurant
          setNewestId(newRestaurant.id)
          setRestaurants((prev) => {
            if (prev.some((r) => r.id === newRestaurant.id)) return prev
            const withVotes: RestaurantWithVotes = { ...newRestaurant, votes: [] }
            const updated = [...prev, withVotes]
            const sorted = sortRestaurants(updated, userIds)
            setAgreed(checkAgreement(sorted, userIds))
            return sorted
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        (payload) => {
          if (!mounted) return
          const vote = (payload.new ?? payload.old) as Vote
          setRestaurants((prev) => {
            const updated = prev.map((r) => {
              if (r.id !== vote.restaurant_id) return r
              const filteredVotes = r.votes.filter((v) => v.id !== vote.id)
              const newVotes =
                payload.eventType === 'DELETE' ? filteredVotes : [...filteredVotes, payload.new as Vote]
              return { ...r, votes: newVotes }
            })
            const sorted = sortRestaurants(updated, userIds)
            setAgreed(checkAgreement(sorted, userIds))
            return sorted
          })
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userIds.join(',')])

  async function addRestaurant(
    inputName: string,
    foundName: string,
    address: string,
    lat: number,
    lng: number,
    addedBy: string
  ) {
    const { data, error } = await supabase
      .from('restaurants')
      .insert({ session_id: sessionId!, input_name: inputName, found_name: foundName, address, lat, lng, added_by: addedBy })
      .select()
      .single()

    if (error) throw error

    // Optimistic update so the pin drops immediately without waiting for the Realtime event
    const newRestaurant: RestaurantWithVotes = { ...data, votes: [] }
    setNewestId(data.id)
    setRestaurants((prev) => {
      if (prev.some((r) => r.id === data.id)) return prev
      const updated = [...prev, newRestaurant]
      const sorted = sortRestaurants(updated, userIds)
      setAgreed(checkAgreement(sorted, userIds))
      return sorted
    })

    return data
  }

  async function castVote(restaurantId: string, userId: string, score: number) {
    const { error } = await supabase.from('votes').upsert(
      { restaurant_id: restaurantId, user_id: userId, score },
      { onConflict: 'restaurant_id,user_id' }
    )
    if (error) throw error
  }

  return { restaurants, newestId, agreed, loading, addRestaurant, castVote }
}

function mergeVotes(restaurants: Restaurant[], votes: Vote[]): RestaurantWithVotes[] {
  return restaurants.map((r) => ({
    ...r,
    votes: votes.filter((v) => v.restaurant_id === r.id),
  }))
}
