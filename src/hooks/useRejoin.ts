import { useEffect } from 'react'
import { socket } from '../lib/socket'
import type { SessionUser } from '../types'

export function useRejoin(sessionId: string | undefined, user: SessionUser | null) {
  // Send join_session on mount/refresh so the server restores state
  useEffect(() => {
    if (!user || !sessionId) return
    socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
  }, [sessionId, user])

  // Re-register after any WebSocket reconnect (new ws object = unregistered)
  useEffect(() => {
    if (!user || !sessionId) return
    return socket.subscribeToOpen(() => {
      socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
    })
  }, [sessionId, user])
}
