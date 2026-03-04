import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Session, RestaurantWithVotes } from '../types'

// Fix Leaflet's broken default icon path in bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const dropIcon = L.divIcon({
  className: 'pin-drop',
  html: `<div class="pin-drop-inner"><div class="pin-head"></div><div class="pin-shadow"></div></div>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

const defaultCenter: [number, number] = [39.8283, -98.5795] // geographic center of USA

interface FlyToProps {
  lat: number
  lng: number
  zoom?: number
}

function FlyTo({ lat, lng, zoom = 14 }: FlyToProps) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])
  return null
}

function SetCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])
  return null
}

interface MapViewProps {
  session: Session | null
  restaurants: RestaurantWithVotes[]
  newestId: string | null
}

export default function MapView({ session, restaurants, newestId }: MapViewProps) {
  const prevNewestId = useRef<string | null>(null)

  const center: [number, number] =
    session?.location_lat != null && session?.location_lng != null
      ? [session.location_lat, session.location_lng]
      : defaultCenter

  const newestRestaurant =
    newestId && newestId !== prevNewestId.current
      ? (restaurants.find((r) => r.id === newestId) ?? null)
      : null

  useEffect(() => {
    if (newestId) {
      prevNewestId.current = newestId
    }
  }, [newestId])

  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={session?.location_lat != null ? 13 : 4}
        className="leaflet-map"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {session?.location_lat != null && session?.location_lng != null && !newestRestaurant && (
          <SetCenter lat={session.location_lat} lng={session.location_lng} />
        )}

        {newestRestaurant?.lat != null && newestRestaurant?.lng != null && (
          <FlyTo lat={newestRestaurant.lat} lng={newestRestaurant.lng} />
        )}

        {restaurants.map((r) => {
          if (r.lat == null || r.lng == null) return null
          const isNew = r.id === newestId
          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={isNew ? dropIcon : new L.Icon.Default()}
            >
              <Popup>
                <strong>{r.found_name ?? r.input_name}</strong>
                {r.address && <><br />{r.address}</>}
                <br />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Directions
                </a>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
