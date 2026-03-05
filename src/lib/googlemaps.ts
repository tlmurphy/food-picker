import type { PlaceResult } from '../types'

export interface GeocodedLocation {
  lat: number
  lng: number
  label: string
}

export async function searchNearbyRestaurant(
  name: string,
  lat: number,
  lng: number,
  radiusMeters = 50000 // ~31 miles (Google's max for circle locationBias)
): Promise<PlaceResult | null> {
  const response = await fetch('/api/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      textQuery: name,
      includedType: 'restaurant',
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      pageSize: 10,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('Google Places API error body:', err)
    throw new Error(`Google Places API error: ${response.status}`)
  }

  const data = await response.json()
  const best = data.places?.[0]

  console.log('Google Places search results:', data.places)

  if (!best) return null

  return {
    lat: best.location.latitude,
    lng: best.location.longitude,
    name: best.displayName?.text ?? name,
    address: best.formattedAddress ?? '',
  }
}

type PlaceSuggestion = { placeId: string; text: string; distanceMeters?: number }
type AutocompleteBody = {
  input: string
  includedPrimaryTypes?: string[]
  locationBias?: object
  origin?: { latitude: number; longitude: number }
}

async function fetchAutocomplete(body: AutocompleteBody): Promise<PlaceSuggestion[]> {
  const response = await fetch('/api/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Autocomplete error: ${response.status}`)
  const data = await response.json()
  type RawSuggestion = { placePrediction: { placeId: string; text: { text: string }; distanceMeters?: number } }
  const suggestions: PlaceSuggestion[] = (data.suggestions ?? []).map((s: RawSuggestion) => ({
    placeId: s.placePrediction.placeId,
    text: s.placePrediction.text.text,
    distanceMeters: s.placePrediction.distanceMeters,
  }))
  if (body.origin) {
    suggestions.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
  }
  return suggestions
}

export async function autocompleteLocation(input: string): Promise<PlaceSuggestion[]> {
  return fetchAutocomplete({ input })
}

export async function autocompleteRestaurant(
  input: string,
  lat: number,
  lng: number,
  radiusMeters = 50000
): Promise<PlaceSuggestion[]> {
  return fetchAutocomplete({
    input,
    includedPrimaryTypes: ['restaurant', 'meal_takeaway', 'meal_delivery', 'food'],
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
    },
    origin: { latitude: lat, longitude: lng },
  })
}

export async function getPlaceLocation(placeId: string): Promise<GeocodedLocation> {
  const response = await fetch(`/api/places/${placeId}`)
  if (!response.ok) throw new Error(`Place details error: ${response.status}`)
  const data = await response.json()
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    label: data.displayName?.text ?? placeId,
  }
}

export async function getRestaurantPlaceDetails(placeId: string): Promise<PlaceResult> {
  const response = await fetch(`/api/places/${placeId}`)
  if (!response.ok) throw new Error(`Place details error: ${response.status}`)
  const data = await response.json()
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    name: data.displayName?.text ?? placeId,
    address: data.formattedAddress ?? '',
  }
}
