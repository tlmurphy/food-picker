export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          location_lat: number | null
          location_lng: number | null
          location_label: string | null
          created_at: string
        }
        Insert: {
          id: string
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_label?: string | null
          created_at?: string
        }
        Relationships: []
      }
      session_users: {
        Row: {
          id: string
          session_id: string
          name: string
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          name: string
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          name?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_users_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          }
        ]
      }
      restaurants: {
        Row: {
          id: string
          session_id: string
          input_name: string
          found_name: string | null
          address: string | null
          lat: number | null
          lng: number | null
          added_by: string | null
          added_at: string
        }
        Insert: {
          id?: string
          session_id: string
          input_name: string
          found_name?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          added_by?: string | null
          added_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          input_name?: string
          found_name?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          added_by?: string | null
          added_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'restaurants_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'restaurants_added_by_fkey'
            columns: ['added_by']
            isOneToOne: false
            referencedRelation: 'session_users'
            referencedColumns: ['id']
          }
        ]
      }
      votes: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          score: number
          voted_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          score: number
          voted_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string
          score?: number
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'votes_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'votes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'session_users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
