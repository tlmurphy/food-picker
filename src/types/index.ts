export interface Session {
  id: string
  locationLat: number | null
  locationLng: number | null
  locationLabel: string | null
}

export interface SessionUser {
  id: string
  sessionId: string
  name: string
  joinedAt: string
}

export interface Vote {
  id: string
  restaurantId: string
  userId: string
  votedAt: string
}

export interface Elimination {
  round: number
  restaurant1: string
  restaurant2: string
  winnerId: string
}

export interface Restaurant {
  id: string
  sessionId: string
  inputName: string
  foundName: string | null
  address: string | null
  lat: number | null
  lng: number | null
  addedBy: string | null
  addedAt: string
  votes: Vote[]
}

export interface PlaceResult {
  lat: number
  lng: number
  name: string
  address: string
}
