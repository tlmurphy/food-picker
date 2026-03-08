export type { Session, SessionUser, Vote, Elimination, Restaurant, ClientMessage, ServerMessage } from '../../shared/types.ts'

export interface PlaceResult {
  lat: number
  lng: number
  name: string
  address: string
}
