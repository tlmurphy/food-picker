import { useState, useEffect } from 'react'
import type { SessionUser } from '../types'

const STORAGE_KEY_PREFIX = 'food-picker-user-'

export function useUser(sessionId: string | undefined) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (!sessionId) return null
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + sessionId)
    return stored ? (JSON.parse(stored) as SessionUser) : null
  })

  useEffect(() => {
    if (!sessionId) return
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + sessionId)
    setUser(stored ? (JSON.parse(stored) as SessionUser) : null)
  }, [sessionId])

  function saveUser(sessionUser: SessionUser) {
    if (!sessionId) return
    localStorage.setItem(STORAGE_KEY_PREFIX + sessionId, JSON.stringify(sessionUser))
    setUser(sessionUser)
  }

  function clearUser() {
    if (!sessionId) return
    localStorage.removeItem(STORAGE_KEY_PREFIX + sessionId)
    setUser(null)
  }

  return { user, saveUser, clearUser }
}
