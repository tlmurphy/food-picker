import { useState, useEffect } from 'react'
import { socket } from '../lib/socket'
import type { Session, SessionUser } from '../types'

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<Session | null>(null)
  const [users, setUsers] = useState<SessionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = socket.subscribe((msg) => {
      switch (msg.type) {
        case 'session_state':
          setSession(msg.session)
          setUsers(msg.users)
          setLoading(false)
          break

        case 'error':
          setError(msg.message)
          setLoading(false)
          break

        case 'user_joined':
          setUsers((prev) => {
            if (prev.some((u) => u.id === msg.user.id)) return prev
            return [...prev, msg.user]
          })
          break

        case 'location_updated':
          setSession((prev) =>
            prev ? { ...prev, locationLat: msg.lat, locationLng: msg.lng, locationLabel: msg.label, locationSetBy: msg.locationSetBy } : prev
          )
          break
      }
    })

    return unsubscribe
  }, [sessionId])

  async function updateLocation(lat: number, lng: number, label: string, userId: string) {
    if (!sessionId) return
    // Optimistic update
    setSession((prev) => prev ? { ...prev, locationLat: lat, locationLng: lng, locationLabel: label, locationSetBy: userId } : prev)
    socket.send({ type: 'update_location', lat, lng, label, userId })
  }

  return { session, users, loading, error, updateLocation }
}
