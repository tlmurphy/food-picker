import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AddRestaurant from '../components/AddRestaurant'
import CelebrationOverlay from '../components/CelebrationOverlay'
import CoinFlip from '../components/CoinFlip'
import LocationSetup from '../components/LocationSetup'
import MapView from '../components/MapView'
import RestaurantList from '../components/RestaurantList'
import { useRestaurants } from '../hooks/useRestaurants'
import { useSession } from '../hooks/useSession'
import { useUser } from '../hooks/useUser'
import { setApiSessionId } from '../lib/googlemaps'
import { socket } from '../lib/socket'
import { getTopTied } from '../lib/sort'

export default function Game() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useUser(sessionId)
  const { session, users, loading: sessionLoading, error: sessionError, updateLocation } = useSession(sessionId)
  const [showCoinFlip, setShowCoinFlip] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const {
    restaurants,
    newestId,
    pickResult,
    loading: restLoading,
    addRestaurant,
    castVote,
    resolvePick,
    clearPickResult,
  } = useRestaurants(sessionId, {
    onPickResolved: (result) => {
      if (result.eliminations.length > 0) {
        setShowCoinFlip(true)
      } else {
        setShowCelebration(true)
      }
    },
  })
  const [mapOpen, setMapOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (sessionId) setApiSessionId(sessionId)
  }, [sessionId])

  // Rejoin session on direct page load / refresh (user already in localStorage)
  useEffect(() => {
    if (!user || !sessionId) return
    socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
  }, [sessionId, user])

  // Re-register with server after any WebSocket reconnect (new ws object = unregistered)
  useEffect(() => {
    if (!user || !sessionId) return
    return socket.subscribeToOpen(() => {
      socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
    })
  }, [sessionId, user])

  useEffect(() => {
    if (!user) {
      void navigate(`/?join=${sessionId}`, { replace: true })
    }
  }, [user, navigate, sessionId])

  if ((sessionLoading || restLoading) && !sessionError) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="error-screen">
        <p>{sessionError}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void navigate('/')
          }}
        >
          Back to Home
        </button>
      </div>
    )
  }

  if (!user) return null

  const hasLocation = session !== null && session.locationLat != null && session.locationLng != null
  const locationSetter = session?.locationSetBy ? (users.find((u) => u.id === session.locationSetBy) ?? null) : null
  const { top, maxVotes } = getTopTied(restaurants)

  const winnerRestaurant = pickResult ? restaurants.find((r) => r.id === pickResult.winnerId) : null

  let pickButtonLabel = ''
  let pickButtonDisabled = true
  if (maxVotes > 0) {
    pickButtonDisabled = false
    pickButtonLabel = top.length === 1 ? 'Pick Now!' : 'Coin Flip!'
  }

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

  function handlePickClick() {
    resolvePick()
  }

  function handleCoinFlipComplete() {
    setShowCoinFlip(false)
    setShowCelebration(true)
  }

  function handleDismiss() {
    setShowCelebration(false)
    setShowCoinFlip(false)
    clearPickResult()
  }

  return (
    <div className="game-layout">
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
              <span key={u.id} className={`player-chip ${u.id === user.id ? 'you' : ''}`}>
                {u.name} {u.id === user.id ? '(you)' : ''}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="game-body">
        <section className="list-panel">
          {!hasLocation ? (
            <LocationSetup onSetLocation={(lat, lng, label) => updateLocation(lat, lng, label, user.id)} />
          ) : (
            <>
              <div className="location-banner">
                <span className="location-banner-label">📍 {session.locationLabel}</span>
                {locationSetter && <span className="location-banner-setter">set by {locationSetter.name}</span>}
              </div>
              <AddRestaurant session={session} userId={user.id} restaurants={restaurants} onAdd={addRestaurant} />
              <div className="list-scroll">
                {restaurants.length > 0 && (
                  <button type="button" className="btn btn-map" onClick={() => setMapOpen(true)}>
                    View Map
                  </button>
                )}
                <RestaurantList restaurants={restaurants} users={users} currentUserId={user.id} onVote={castVote} />
              </div>
              {!pickButtonDisabled && (
                <button type="button" className="btn pick-button" onClick={handlePickClick}>
                  {pickButtonLabel}
                </button>
              )}
            </>
          )}
        </section>
      </main>

      {mapOpen && (
        <div className="map-overlay">
          <button type="button" className="btn btn-close-map" onClick={() => setMapOpen(false)}>
            Close
          </button>
          <MapView session={session} restaurants={restaurants} newestId={newestId} visible={mapOpen} />
        </div>
      )}

      {showCoinFlip && pickResult && (
        <CoinFlip
          eliminations={pickResult.eliminations}
          restaurants={restaurants}
          onComplete={handleCoinFlipComplete}
        />
      )}

      {showCelebration && winnerRestaurant && (
        <CelebrationOverlay restaurant={winnerRestaurant} onDismiss={handleDismiss} />
      )}
    </div>
  )
}
