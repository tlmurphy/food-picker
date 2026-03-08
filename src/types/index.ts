export type {
  ClientMessage,
  Elimination,
  Restaurant,
  ServerMessage,
  Session,
  SessionUser,
  Vote,
} from '../../shared/types.ts'

export interface PlaceResult {
  lat: number
  lng: number
  name: string
  address: string
}
