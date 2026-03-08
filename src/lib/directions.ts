const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)

export function getDirectionsUrl(lat: number, lng: number): string {
  if (isAppleDevice) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
