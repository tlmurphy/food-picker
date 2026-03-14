import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDebounce } from '../hooks/useDebounce'
import { autocompleteRestaurant, getRestaurantPlaceDetails } from '../lib/googlemaps'
import type { Restaurant, Session } from '../types'

interface Props {
  session: Session
  userId: string
  restaurants: Restaurant[]
  onAdd: (inputName: string, foundName: string, address: string, lat: number, lng: number, addedBy: string) => void
}

export default function AddRestaurant({ session, userId, restaurants, onAdd }: Props) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debouncedValue = useDebounce(value, 300)
  const { locationLat, locationLng } = session

  useEffect(() => {
    if (!debouncedValue.trim() || locationLat == null || locationLng == null) {
      setSuggestions([])
      return
    }
    void (async () => {
      try {
        const results = await autocompleteRestaurant(debouncedValue.trim(), locationLat, locationLng)
        setSuggestions(results)
      } catch {
        // Silently fail autocomplete
      }
    })()
  }, [debouncedValue, locationLat, locationLng])

  async function handleSelect(placeId: string, suggestionText: string) {
    setSuggestions([])
    setValue('')
    setLoading(true)
    setError('')
    try {
      const details = await getRestaurantPlaceDetails(placeId)
      const isDuplicate = restaurants.some(
        (r) =>
          r.foundName?.toLowerCase() === details.name.toLowerCase() &&
          r.address?.toLowerCase() === details.address.toLowerCase(),
      )
      if (isDuplicate) {
        toast.error(`${details.name} at ${details.address} has already been added.`)
        return
      }
      onAdd(suggestionText, details.name, details.address, details.lat, details.lng, userId)
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
              <li
                key={s.placeId}
                onMouseDown={() => {
                  void handleSelect(s.placeId, s.text)
                }}
              >
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
