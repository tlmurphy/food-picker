import type { PlaceResult } from '../types'

function nameSimilarity(query: string, candidate: string): number {
  const q = query.toLowerCase().trim()
  const c = candidate.toLowerCase().trim()

  if (c === q) return 1
  if (c.includes(q) || q.includes(c)) return 0.9

  // Dice coefficient over character bigrams
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }

  const qb = bigrams(q)
  const cb = bigrams(c)
  let intersection = 0
  for (const b of qb) if (cb.has(b)) intersection++

  const total = qb.size + cb.size
  return total === 0 ? 0 : (2 * intersection) / total
}

export async function searchNearbyRestaurant(
  name: string,
  lat: number,
  lng: number,
  radiusMeters = 80467 // ~50 miles
): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    query: name,
    ll: `${lat},${lng}`,
    radius: String(radiusMeters),
    limit: '10',
    fsq_category_ids: '4d4b7105d754a06374d81259', // Dining and Drinking
  })

  const response = await fetch(`/api/places/search?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Foursquare API error: ${response.status}`)
  }

  const data = await response.json()
  const results: any[] = data.results ?? []

  const valid = results.filter(p => p.latitude != null && p.longitude != null)
  if (valid.length === 0) return null

  const maxDist = Math.max(...valid.map(p => p.distance ?? radiusMeters), 1)

  const scored = valid
    .map(p => {
      const nameScore = nameSimilarity(name, p.name ?? '')
      const distScore = 1 - (p.distance ?? radiusMeters) / maxDist
      return { place: p, score: 0.6 * nameScore + 0.4 * distScore }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0].place
  return {
    lat: best.latitude,
    lng: best.longitude,
    name: best.name ?? name,
    address: best.location?.formatted_address ?? '',
  }
}
