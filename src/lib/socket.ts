import type { ClientMessage, ServerMessage } from './socketTypes'

type MessageHandler = (msg: ServerMessage) => void

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:5173/ws'
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 16000

class SocketClient {
  private ws: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private reconnectDelay = RECONNECT_BASE_MS
  private shouldReconnect = true
  private pendingQueue: ClientMessage[] = []

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      console.log('[socket] connected')
      this.reconnectDelay = RECONNECT_BASE_MS
      for (const msg of this.pendingQueue) {
        this.ws!.send(JSON.stringify(msg))
      }
      this.pendingQueue = []
    }

    this.ws.onmessage = (event) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        console.error('[socket] invalid JSON from server')
        return
      }
      for (const handler of this.handlers) {
        handler(msg)
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      if (this.shouldReconnect) {
        console.log(`[socket] closed — reconnecting in ${this.reconnectDelay}ms`)
        setTimeout(() => this.connect(), this.reconnectDelay)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      this.pendingQueue.push(msg)
    }
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export const socket = new SocketClient()
socket.connect()
