import type { PlaceResult } from '../types'

let _sessionId = ''
export function setApiSessionId(id: string) { _sessionId = id }
function sessionHeader(): Record<string, string> {
  return _sessionId ? { 'X-Session-Id': _sessionId } : {}
}

export interface GeocodedLocation {
  lat: number
  lng: number
  label: string
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
    headers: { 'Content-Type': 'application/json', ...sessionHeader() },
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
  const response = await fetch(`/api/places/${placeId}`, { headers: sessionHeader() })
  if (!response.ok) throw new Error(`Place details error: ${response.status}`)
  const data = await response.json()
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    label: data.displayName?.text ?? placeId,
  }
}

export async function getRestaurantPlaceDetails(placeId: string): Promise<PlaceResult> {
  const response = await fetch(`/api/places/${placeId}`, { headers: sessionHeader() })
  if (!response.ok) throw new Error(`Place details error: ${response.status}`)
  const data = await response.json()
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    name: data.displayName?.text ?? placeId,
    address: data.formattedAddress ?? '',
  }
}
