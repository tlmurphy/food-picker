import type { PlaceResult } from '../types'

export async function searchNearbyRestaurant(
  name: string,
  lat: number,
  lng: number,
  radiusMeters = 5000
): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    query: name,
    ll: `${lat},${lng}`,
    radius: String(radiusMeters),
    limit: '1',
    categories: '4d4b7105d754a06374d81259', // Food & Dining
  })

  const response = await fetch(`/api/places/search?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Foursquare API error: ${response.status}`)
  }

  const data = await response.json()
  const place = data.results?.[0]

  if (!place) return null
  if (place.latitude == null || place.longitude == null) return null

  return {
    lat: place.latitude,
    lng: place.longitude,
    name: place.name ?? name,
    address: place.location?.formatted_address ?? '',
  }
}
