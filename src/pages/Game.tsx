import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useRestaurants } from '../hooks/useRestaurants'
import { useUser } from '../hooks/useUser'
import { socket } from '../lib/socket'
import { setApiSessionId } from '../lib/googlemaps'
import MapView from '../components/MapView'
import RestaurantList from '../components/RestaurantList'
import AddRestaurant from '../components/AddRestaurant'
import LocationSetup from '../components/LocationSetup'
import CelebrationOverlay from '../components/CelebrationOverlay'

export default function Game() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useUser(sessionId)
  const { session, users, loading: sessionLoading, error: sessionError, updateLocation } = useSession(sessionId)
  const userIds = users.map((u) => u.id)
  const { restaurants, newestId, agreed, loading: restLoading, addRestaurant, castVote } = useRestaurants(
    sessionId,
    userIds
  )
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    if (sessionId) setApiSessionId(sessionId)
  }, [sessionId])

  // Rejoin session on direct page load / refresh (user already in localStorage)
  useEffect(() => {
    if (!user || !sessionId) return
    socket.send({ type: 'join_session', sessionId, userId: user.id, userName: user.name })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id])

  useEffect(() => {
    if (!user) {
      navigate(`/?join=${sessionId}`, { replace: true })
    }
  }, [user, navigate, sessionId])

  if (sessionLoading || restLoading) {
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
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    )
  }

  if (!user) return null

  const hasLocation = session?.locationLat != null && session?.locationLng != null

  return (
    <div className="game-layout">
      <header className="game-header">
        <h2 className="game-title">🍔 Food Picker</h2>
        <div className="session-info">
          <span className="session-badge">#{sessionId}</span>
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
            <LocationSetup onSetLocation={updateLocation} />
          ) : (
            <>
              <AddRestaurant
                session={session!}
                userId={user.id}
                onAdd={addRestaurant}
              />
              {restaurants.length > 0 && (
                <button className="btn btn-map" onClick={() => setMapOpen(true)}>
                  View Map
                </button>
              )}
              <RestaurantList
                restaurants={restaurants}
                users={users}
                currentUserId={user.id}
                onVote={castVote}
              />
            </>
          )}
        </section>
      </main>

      {mapOpen && (
        <div className="map-overlay">
          <button className="btn btn-close-map" onClick={() => setMapOpen(false)}>
            Close
          </button>
          <MapView
            session={session}
            restaurants={restaurants}
            newestId={newestId}
            visible={mapOpen}
          />
        </div>
      )}

      {agreed && <CelebrationOverlay restaurant={agreed} />}
    </div>
  )
}
