import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { autocompleteLocation, getPlaceLocation, reverseGeocode } from '../lib/googlemaps'

interface Props {
  onSetLocation: (lat: number, lng: number, label: string) => void
}

export default function LocationSetup({ onSetLocation }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await autocompleteLocation(query.trim())
        setSuggestions(results)
      } catch {
        // Silently fail autocomplete — don't show error for background fetches
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function handleSelect(placeId: string) {
    setSuggestions([])
    setLoading(true)
    setError('')
    try {
      const location = await getPlaceLocation(placeId)
      onSetLocation(location.lat, location.lng, location.label)
    } catch {
      setError('Failed to load location details. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBlur() {
    // Delay so a click on a suggestion registers before the dropdown closes
    setTimeout(() => setSuggestions([]), 150)
  }

  function handleUseMyLocation() {
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        void (async () => {
          const label = (await reverseGeocode(latitude, longitude)) ?? 'My location'
          onSetLocation(latitude, longitude, label)
          setLoading(false)
        })()
      },
      () => {
        setError('Could not get your location. Try typing it instead.')
        setLoading(false)
      }
    )
  }

  return (
    <motion.div
      className="location-setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h3>Where are you?</h3>
      <p className="location-hint">Set a location so we can find nearby restaurants.</p>

      <div className="autocomplete-wrapper">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={handleBlur}
          placeholder="City, neighborhood, or address"
          disabled={loading}
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <ul className="autocomplete-dropdown">
            {suggestions.map((s) => (
              <li key={s.placeId} onMouseDown={() => { void handleSelect(s.placeId) }}>
                {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="btn btn-ghost use-location-btn"
        onClick={handleUseMyLocation}
        disabled={loading}
        type="button"
      >
        📍 Use my current location
      </button>

      {error && <p className="error-text">{error}</p>}
    </motion.div>
  )
}
