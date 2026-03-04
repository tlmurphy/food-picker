import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import type { RestaurantWithVotes } from '../types'

interface Props {
  restaurant: RestaurantWithVotes
}

export default function CelebrationOverlay({ restaurant }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const end = Date.now() + 4000

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'],
      })
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'],
      })

      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }, [])

  const directionsUrl =
    restaurant.lat != null && restaurant.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`
      : null

  return (
    <motion.div
      className="celebration-overlay"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="celebration-card">
        <div className="celebration-emoji">🎉</div>
        <h2>You both agree!</h2>
        <p className="celebration-name">{restaurant.found_name ?? restaurant.input_name}</p>
        {restaurant.address && <p className="celebration-address">{restaurant.address}</p>}

        {directionsUrl && (
          <a
            className="btn btn-primary celebration-btn"
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🗺️ Get Directions
          </a>
        )}
      </div>
    </motion.div>
  )
}
