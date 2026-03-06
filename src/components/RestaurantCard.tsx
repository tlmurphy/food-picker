import { motion } from 'framer-motion'
import type { Restaurant, SessionUser } from '../types'

interface Props {
  restaurant: Restaurant
  users: SessionUser[]
  currentUserId: string
  rank: number
  onVote: (restaurantId: string, userId: string, score: number) => void
}

export default function RestaurantCard({ restaurant, users, currentUserId, rank, onVote }: Props) {
  const myVote = restaurant.votes.find((v) => v.userId === currentUserId)

  const bothVoted1 = users.length >= 2 && users.every((u) => {
    const v = restaurant.votes.find((vt) => vt.userId === u.id)
    return v?.score === 1
  })

  return (
    <motion.div
      className={`restaurant-card ${bothVoted1 ? 'agreed' : ''}`}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-rank">{rank}</div>

      <div className="card-info">
        <h3 className="card-name">{restaurant.foundName ?? restaurant.inputName}</h3>
        {restaurant.address && <p className="card-address">{restaurant.address}</p>}

        <div className="vote-row">
          {[1, 2, 3].map((score) => (
            <button
              key={score}
              className={`vote-btn ${myVote?.score === score ? 'active' : ''}`}
              onClick={() => onVote(restaurant.id, currentUserId, score)}
              title={score === 1 ? 'Top pick' : score === 2 ? 'Okay' : 'Last resort'}
            >
              {score === 1 ? '🥇' : score === 2 ? '🥈' : '🥉'}
            </button>
          ))}
        </div>

        <div className="other-votes">
          {users.map((u) => {
            const v = restaurant.votes.find((vt) => vt.userId === u.id)
            if (u.id === currentUserId) return null
            return (
              <span key={u.id} className="other-vote-chip">
                {u.name}: {v ? `#${v.score}` : '—'}
              </span>
            )
          })}
        </div>
      </div>

      {restaurant.lat != null && restaurant.lng != null && (
        <a
          className="directions-link"
          href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Get directions"
        >
          ↗
        </a>
      )}

      {bothVoted1 && <div className="agreed-badge">✓ Agreed!</div>}
    </motion.div>
  )
}
