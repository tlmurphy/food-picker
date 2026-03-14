import L from 'leaflet'
import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getDirectionsUrl } from '../lib/directions'
import { getRestaurantName } from '../lib/sort'
import type { Restaurant, Session } from '../types'

const restaurantIcon = L.divIcon({
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
  }, [lat, lng, zoom, map])
  return null
}

function SetCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 13)
  }, [lat, lng, map])
  return null
}

const originIcon = L.divIcon({
  className: 'origin-marker',
  html: `<div class="origin-marker-inner"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
})

function InvalidateSize({ visible }: { visible?: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (visible) {
      setTimeout(() => map.invalidateSize(), 50)
    }
  }, [visible, map])
  return null
}

interface MapViewProps {
  session: Session | null
  restaurants: Restaurant[]
  newestId: string | null
  visible?: boolean
}

export default function MapView({ session, restaurants, newestId, visible }: MapViewProps) {
  const [prevNewestId, setPrevNewestId] = useState<string | null>(newestId)
  const [newestRestaurant, setNewestRestaurant] = useState<Restaurant | null>(null)

  // Detect a newly added restaurant by comparing newestId to its previous value.
  // React's "update during render" pattern: call setState during render when a
  // prop changes — React re-renders immediately with the updated state.
  if (newestId !== prevNewestId) {
    setPrevNewestId(newestId)
    setNewestRestaurant(newestId ? (restaurants.find((r) => r.id === newestId) ?? null) : null)
  }

  const center: [number, number] =
    session?.locationLat != null && session?.locationLng != null
      ? [session.locationLat, session.locationLng]
      : defaultCenter

  return (
    <div className="map-wrapper">
      <MapContainer center={center} zoom={session?.locationLat != null ? 13 : 4} className="leaflet-map" zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <InvalidateSize visible={visible} />

        {session?.locationLat != null && session?.locationLng != null && (
          <>
            {!newestRestaurant && <SetCenter lat={session.locationLat} lng={session.locationLng} />}
            <Marker position={[session.locationLat, session.locationLng]} icon={originIcon}>
              <Popup>
                <strong>Starting Point</strong>
                {session.locationLabel && (
                  <>
                    <br />
                    {session.locationLabel}
                  </>
                )}
              </Popup>
            </Marker>
          </>
        )}

        {newestRestaurant?.lat != null && newestRestaurant?.lng != null && (
          <FlyTo lat={newestRestaurant.lat} lng={newestRestaurant.lng} />
        )}

        {restaurants.map((r) => {
          if (r.lat == null || r.lng == null) return null
          return (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={restaurantIcon}>
              <Tooltip permanent direction="top" offset={[0, -36]} className="restaurant-tooltip">
                {getRestaurantName(r)}
              </Tooltip>
              <Popup>
                <strong>{r.foundName ?? r.inputName}</strong>
                {r.address && (
                  <>
                    <br />
                    {r.address}
                  </>
                )}
                <br />
                <a href={getDirectionsUrl(r.lat, r.lng)} target="_blank" rel="noopener noreferrer">
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
