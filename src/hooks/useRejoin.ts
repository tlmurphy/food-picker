import { useEffect } from 'react'
import { socket } from '../lib/socket'
import type { SessionUser } from '../types'

export function useRejoin(sessionId: string | undefined, user: SessionUser | null) {
  // Send join_session on mount and re-register after any WebSocket reconnect
  useEffect(() => {
    if (!user || !sessionId) return
    socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
    return socket.subscribeToOpen(() => {
      socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
    })
  }, [sessionId, user])
}
