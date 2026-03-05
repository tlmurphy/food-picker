import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { autocompleteRestaurant, getRestaurantPlaceDetails } from '../lib/googlemaps'
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

export default function AddRestaurant({ session, userId, onAdd }: Props) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim() || session.location_lat == null || session.location_lng == null) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await autocompleteRestaurant(
          value.trim(),
          session.location_lat!,
          session.location_lng!
        )
        setSuggestions(results)
      } catch {
        // Silently fail autocomplete
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, session.location_lat, session.location_lng])

  async function handleSelect(placeId: string, suggestionText: string) {
    setSuggestions([])
    setValue('')
    setLoading(true)
    setError('')
    try {
      const details = await getRestaurantPlaceDetails(placeId)
      await onAdd(suggestionText, details.name, details.address, details.lat, details.lng, userId)
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBlur() {
    setTimeout(() => setSuggestions([]), 150)
  }

  return (
    <div className="add-restaurant">
      <div className="autocomplete-wrapper">
        <input
          className="input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          onBlur={handleBlur}
          placeholder="Add a restaurant (e.g. McDonald's)"
          disabled={loading}
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <ul className="autocomplete-dropdown">
            {suggestions.map((s) => (
              <li key={s.placeId} onMouseDown={() => handleSelect(s.placeId, s.text)}>
                {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className="add-status-msg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
