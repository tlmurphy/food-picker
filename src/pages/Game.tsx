import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AddRestaurant from '../components/AddRestaurant'
import CelebrationOverlay from '../components/CelebrationOverlay'
import CoinFlip from '../components/CoinFlip'
import GameHeader from '../components/GameHeader'
import LocationSetup from '../components/LocationSetup'
import MapView from '../components/MapView'
import RestaurantList from '../components/RestaurantList'
import { useRejoin } from '../hooks/useRejoin'
import { useRestaurants } from '../hooks/useRestaurants'
import { useSession } from '../hooks/useSession'
import { useUser } from '../hooks/useUser'
import { setApiSessionId } from '../lib/googlemaps'
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

  useEffect(() => {
    if (sessionId) setApiSessionId(sessionId)
  }, [sessionId])

  useRejoin(sessionId, user)

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
      <GameHeader sessionId={sessionId ?? ''} users={users} currentUserId={user.id} />

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
              {maxVotes > 0 && (
                <button type="button" className="btn pick-button" onClick={resolvePick}>
                  {top.length === 1 ? 'Pick Now!' : 'Coin Flip!'}
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
