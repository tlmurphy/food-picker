import { useState } from 'react'
import { motion } from 'framer-motion'
import { geocodeLocation } from '../lib/nominatim'

interface Props {
  onSetLocation: (lat: number, lng: number, label: string) => Promise<void>
}

export default function LocationSetup({ onSetLocation }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')

    try {
      const result = await geocodeLocation(query.trim())
      if (!result) {
        setError('Location not found. Try being more specific (e.g. "Portland, OR").')
        setLoading(false)
        return
      }
      await onSetLocation(result.lat, result.lng, result.label)
    } catch {
      setError('Failed to look up location. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUseMyLocation() {
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await onSetLocation(pos.coords.latitude, pos.coords.longitude, 'My location')
        setLoading(false)
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

      <form className="add-form" onSubmit={handleSubmit}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, neighborhood, or address"
          disabled={loading}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
          {loading ? '…' : 'Set'}
        </button>
      </form>

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
