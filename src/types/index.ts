import type { Database } from './database.types'

export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionUser = Database['public']['Tables']['session_users']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']

export interface RestaurantWithVotes extends Restaurant {
  votes: Vote[]
}

export interface PlaceResult {
  lat: number
  lng: number
  name: string
  address: string
}
