import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { getDirectionsUrl } from '../lib/directions'
import type { Restaurant } from '../types'

interface Props {
  restaurant: Restaurant
  onDismiss: () => void
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff']

export default function CelebrationOverlay({ restaurant, onDismiss }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const end = Date.now() + 4000

    const frame = () => {
      void confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: CONFETTI_COLORS,
      })
      void confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: CONFETTI_COLORS,
      })

      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }, [])

  const directionsUrl =
    restaurant.lat != null && restaurant.lng != null ? getDirectionsUrl(restaurant.lat, restaurant.lng) : null

  return (
    <motion.div
      className="celebration-overlay"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="celebration-card">
        <div className="celebration-emoji">🎉</div>
        <h2>It's decided!</h2>
        <p className="celebration-name">{restaurant.foundName ?? restaurant.inputName}</p>
        {restaurant.address && <p className="celebration-address">{restaurant.address}</p>}

        {directionsUrl && (
          <a className="btn btn-primary celebration-btn" href={directionsUrl} target="_blank" rel="noopener noreferrer">
            Get Directions
          </a>
        )}

        <button type="button" className="btn celebration-dismiss" onClick={onDismiss}>
          Back to list
        </button>
      </div>
    </motion.div>
  )
}
