export interface GeocodedLocation {
  lat: number
  lng: number
  label: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`)
  }

  const results: NominatimResult[] = await response.json()

  if (!results || results.length === 0) {
    return null
  }

  const result = results[0]
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    label: result.display_name,
  }
}
