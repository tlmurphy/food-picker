export function sanitize(s: unknown, maxLen: number): string {
  if (typeof s !== 'string') return ''
  return s.slice(0, maxLen)
}

export function validCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  )
}
