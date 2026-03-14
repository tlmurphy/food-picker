import { useState } from 'react'
import type { SessionUser } from '../types'

interface Props {
  sessionId: string
  users: SessionUser[]
  currentUserId: string
}

export default function GameHeader({ sessionId, users, currentUserId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    const text = `Join my Food Picker session! Code: #${sessionId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Food Picker', text, url })
        return
      } catch {
        // user cancelled or unsupported — fall through to clipboard
      }
    }
    const fullText = `${text}\n${url}`
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(fullText)
    } else {
      // navigator.clipboard is only available in secure contexts (HTTPS or localhost).
      // This fallback handles local dev over plain HTTP (e.g. http://192.168.x.x).
      // execCommand is deprecated but universally supported and won't be hit in production.
      const ta = document.createElement('textarea')
      ta.value = fullText
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="game-header">
      <h2 className="game-title">Food Picker</h2>
      <div className="session-info">
        <button
          type="button"
          className={`share-btn ${copied ? 'copied' : ''}`}
          onClick={() => {
            void handleShare()
          }}
        >
          {copied ? 'Copied!' : `#${sessionId}`}
          {!copied && (
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          )}
        </button>
        <div className="players">
          {users.map((u) => (
            <span key={u.id} className={`player-chip ${u.id === currentUserId ? 'you' : ''}`}>
              {u.name} {u.id === currentUserId ? '(you)' : ''}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
