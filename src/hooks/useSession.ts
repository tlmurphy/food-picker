import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, SessionUser } from '../types'

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<Session | null>(null)
  const [users, setUsers] = useState<SessionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    let mounted = true

    async function load() {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId!)
        .single()

      if (!mounted) return

      if (sessionError) {
        setError('Session not found.')
        setLoading(false)
        return
      }

      setSession(sessionData)

      const { data: usersData } = await supabase
        .from('session_users')
        .select('*')
        .eq('session_id', sessionId!)
        .order('joined_at')

      if (mounted) {
        setUsers(usersData ?? [])
        setLoading(false)
      }
    }

    load()

    // Real-time: session updates (location changes)
    const sessionChannel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (mounted) setSession(payload.new as Session)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_users',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (mounted) setUsers((prev) => [...prev, payload.new as SessionUser])
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(sessionChannel)
    }
  }, [sessionId])

  async function updateLocation(lat: number, lng: number, label: string) {
    if (!sessionId) return
    await supabase
      .from('sessions')
      .update({ location_lat: lat, location_lng: lng, location_label: label })
      .eq('id', sessionId)
    setSession((prev) => prev ? { ...prev, location_lat: lat, location_lng: lng, location_label: label } : prev)
  }

  return { session, users, loading, error, updateLocation }
}
