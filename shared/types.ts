// Domain types

export interface Session {
  id: string
  locationLat: number | null
  locationLng: number | null
  locationLabel: string | null
  locationSetBy: string | null
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

// Client → Server messages

export type ClientMessage =
  | { type: 'create_session' }
  | { type: 'join_session'; sessionId: string; userId: string; userName: string }
  | { type: 'update_location'; lat: number; lng: number; label: string; userId: string }
  | {
      type: 'add_restaurant'
      inputName: string
      foundName: string
      address: string
      lat: number
      lng: number
      addedBy: string
    }
  | { type: 'cast_vote'; restaurantId: string; userId: string }
  | { type: 'resolve_pick' }

// Server → Client messages

export type ServerMessage =
  | { type: 'session_created'; sessionId: string }
  | { type: 'session_state'; session: Session; users: SessionUser[]; restaurants: Restaurant[] }
  | { type: 'error'; message: string }
  | { type: 'user_joined'; user: SessionUser }
  | { type: 'location_updated'; lat: number; lng: number; label: string; locationSetBy: string | null }
  | { type: 'restaurant_added'; restaurant: Restaurant }
  | { type: 'vote_cast'; vote: Vote }
  | { type: 'vote_removed'; restaurantId: string; userId: string }
  | { type: 'pick_resolved'; winnerId: string; eliminations: Elimination[] }
