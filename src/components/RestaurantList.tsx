import { AnimatePresence } from 'framer-motion'
import RestaurantCard from './RestaurantCard'
import type { Restaurant, SessionUser } from '../types'

interface Props {
  restaurants: Restaurant[]
  users: SessionUser[]
  currentUserId: string
  onVote: (restaurantId: string, userId: string) => void
}

export default function RestaurantList({ restaurants, users, currentUserId, onVote }: Props) {
  if (restaurants.length === 0) {
    return (
      <div className="empty-list">
        <p>No restaurants yet. Add one above!</p>
      </div>
    )
  }

  return (
    <div className="restaurant-list">
      <AnimatePresence mode="popLayout">
        {restaurants.map((r, idx) => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            users={users}
            currentUserId={currentUserId}
            rank={idx + 1}
            onVote={onVote}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
