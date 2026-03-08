import type { PlaceResult } from '../types'

let _sessionId = ''
export function setApiSessionId(id: string) {
  _sessionId = id
}
function sessionHeader(): Record<string, string> {
  return _sessionId ? { 'X-Session-Id': _sessionId } : {}
}

export interface GeocodedLocation {
  lat: number
  lng: number
  label: string
}

type PlaceSuggestion = { placeId: string; text: string; distanceMeters?: number }

type RawSuggestion = {
  placePrediction: { placeId: string; text: { text: string }; distanceMeters?: number }
}
type AutocompleteResponse = { suggestions?: RawSuggestion[] }

type PlaceApiData = {
  location: { latitude: number; longitude: number }
  displayName?: { text: string }
  formattedAddress?: string
}

type GeocodeResponse = {
  results: Array<{ formatted_address: string }>
}

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
  const data = (await response.json()) as AutocompleteResponse
  const suggestions: PlaceSuggestion[] = (data.suggestions ?? []).map((s) => ({
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
  radiusMeters = 10000,
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

async function fetchPlaceData(placeId: string): Promise<PlaceApiData> {
  const response = await fetch(`/api/places/${placeId}`, { headers: sessionHeader() })
  if (!response.ok) throw new Error(`Place details error: ${response.status}`)
  return response.json() as Promise<PlaceApiData>
}

export async function getPlaceLocation(placeId: string): Promise<GeocodedLocation> {
  const data = await fetchPlaceData(placeId)
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    label: data.displayName?.text ?? placeId,
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const response = await fetch(`/api/geocode?latlng=${lat},${lng}`, { headers: sessionHeader() })
  if (!response.ok) return null
  const data = (await response.json()) as GeocodeResponse
  return data.results[0]?.formatted_address ?? null
}

export async function getRestaurantPlaceDetails(placeId: string): Promise<PlaceResult> {
  const data = await fetchPlaceData(placeId)
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    name: data.displayName?.text ?? placeId,
    address: data.formattedAddress ?? '',
  }
}
