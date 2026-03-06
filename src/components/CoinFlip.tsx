import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Restaurant, Elimination } from '../types'

interface Props {
  eliminations: Elimination[]
  restaurants: Restaurant[]
  onComplete: (winnerId: string) => void
}

function getRestaurantName(restaurants: Restaurant[], id: string): string {
  const r = restaurants.find((r) => r.id === id)
  return r?.foundName ?? r?.inputName ?? 'Unknown'
}

export default function CoinFlip({ eliminations, restaurants, onComplete }: Props) {
  const [currentRound, setCurrentRound] = useState(0)
  const [flipping, setFlipping] = useState(true)
  const [showResult, setShowResult] = useState(false)

  const elimination = eliminations[currentRound]
  const isLastRound = currentRound === eliminations.length - 1

  const advanceRound = useCallback(() => {
    if (isLastRound) {
      onComplete(elimination.winnerId)
    } else {
      setCurrentRound((r) => r + 1)
      setFlipping(true)
      setShowResult(false)
    }
  }, [isLastRound, elimination?.winnerId, onComplete])

  useEffect(() => {
    if (!flipping) return
    const timer = setTimeout(() => {
      setFlipping(false)
      setShowResult(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [flipping, currentRound])

  useEffect(() => {
    if (!showResult || isLastRound) return
    const timer = setTimeout(advanceRound, 1500)
    return () => clearTimeout(timer)
  }, [showResult, isLastRound, advanceRound])

  if (!elimination) return null

  const name1 = getRestaurantName(restaurants, elimination.restaurant1)
  const name2 = getRestaurantName(restaurants, elimination.restaurant2)
  const winnerName = getRestaurantName(restaurants, elimination.winnerId)
  const isHeads = elimination.winnerId === elimination.restaurant1

  return (
    <motion.div
      className="coin-flip-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="coin-flip-card">
        {eliminations.length > 1 && (
          <p className="coin-flip-round">Round {currentRound + 1} of {eliminations.length}</p>
        )}

        <div className="coin-flip-matchup">
          <span className={`matchup-name ${showResult && !isHeads ? 'eliminated' : ''}`}>{name1}</span>
          <span className="matchup-vs">vs</span>
          <span className={`matchup-name ${showResult && isHeads ? 'eliminated' : ''}`}>{name2}</span>
        </div>

        <div className="coin-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRound}
              className={`coin ${flipping ? 'flipping' : ''}`}
              initial={{ rotateY: 0 }}
              animate={flipping
                ? { rotateY: [0, 360, 720, 1080, isHeads ? 1080 : 1260] }
                : { rotateY: isHeads ? 0 : 180 }
              }
              transition={flipping
                ? { duration: 2, ease: 'easeOut' }
                : { duration: 0.3 }
              }
            >
              <div className="coin-face coin-heads">H</div>
              <div className="coin-face coin-tails">T</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {showResult && (
          <motion.div
            className="coin-flip-winner"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="winner-label">{winnerName} wins!</p>
            {isLastRound && (
              <button className="btn btn-primary coin-flip-continue" onClick={() => onComplete(elimination.winnerId)}>
                Continue
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
