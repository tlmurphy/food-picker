import { motion } from 'framer-motion'
import { getDirectionsUrl } from '../lib/directions'
import { getRestaurantName } from '../lib/sort'
import type { Restaurant, SessionUser } from '../types'

interface Props {
  restaurant: Restaurant
  users: SessionUser[]
  currentUserId: string
  rank: number
  onVote: (restaurantId: string, userId: string) => void
}

export default function RestaurantCard({ restaurant, users, currentUserId, rank, onVote }: Props) {
  const hasVoted = restaurant.votes.some((v) => v.userId === currentUserId)
  const voteCount = restaurant.votes.length

  return (
    <motion.div
      className="restaurant-card"
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-rank">{rank}</div>

      <div className="card-info">
        <h3 className="card-name">{getRestaurantName(restaurant)}</h3>
        {restaurant.address && <p className="card-address">{restaurant.address}</p>}

        <div className="vote-row">
          <button
            type="button"
            className={`thumbs-up-btn ${hasVoted ? 'active' : ''}`}
            onClick={() => onVote(restaurant.id, currentUserId)}
            title={hasVoted ? 'Remove vote' : 'Thumbs up'}
          >
            {hasVoted ? '\u{1F44D}' : '\u{1F44D}\u{1F3FB}'}
            {voteCount > 0 && <span className="vote-count">{voteCount}</span>}
          </button>
        </div>

        <div className="other-votes">
          {users.map((u) => {
            const voted = restaurant.votes.some((v) => v.userId === u.id)
            if (u.id === currentUserId) return null
            if (!voted) return null
            return (
              <span key={u.id} className="other-vote-chip">
                {u.name}
              </span>
            )
          })}
        </div>
      </div>

      {restaurant.lat != null && restaurant.lng != null && (
        <a
          className="directions-link"
          href={getDirectionsUrl(restaurant.lat, restaurant.lng)}
          target="_blank"
          rel="noopener noreferrer"
          title="Get directions"
        >
          ↗
        </a>
      )}
    </motion.div>
  )
}
