import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchNearbyRestaurant } from '../lib/overpass'
import type { Session } from '../types'

interface Props {
  session: Session
  userId: string
  onAdd: (
    inputName: string,
    foundName: string,
    address: string,
    lat: number,
    lng: number,
    addedBy: string
  ) => Promise<unknown>
}

type Status = 'idle' | 'searching' | 'not-found' | 'error'

export default function AddRestaurant({ session, userId, onAdd }: Props) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const query = value.trim()
    if (!query) return
    if (session.location_lat == null || session.location_lng == null) return

    setStatus('searching')
    setMessage('')

    try {
      const result = await searchNearbyRestaurant(query, session.location_lat, session.location_lng)

      if (!result) {
        setStatus('not-found')
        setMessage(`No location found for "${query}" nearby. Try a different name.`)
        return
      }

      await onAdd(query, result.name, result.address, result.lat, result.lng, userId)
      setValue('')
      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setMessage('Something went wrong. Check your connection and try again.')
    }
  }

  return (
    <div className="add-restaurant">
      <form className="add-form" onSubmit={handleSubmit}>
        <input
          className="input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setStatus('idle')
          }}
          placeholder="Add a restaurant (e.g. McDonald's)"
          disabled={status === 'searching'}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={status === 'searching' || !value.trim()}
        >
          {status === 'searching' ? '…' : '+'}
        </button>
      </form>

      <AnimatePresence>
        {(status === 'not-found' || status === 'error') && (
          <motion.p
            className="add-status-msg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
