# Food Picker

A collaborative restaurant-picking app for two users on separate devices. Add restaurants, vote on them, and get directions when you both agree.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Real-time sync**: Supabase Realtime (Postgres)
- **Map**: Leaflet.js + OpenStreetMap (free, no API key)
- **Restaurant search & autocomplete**: Google Places API (New)
- **Location autocomplete**: Google Places API (New)
- **Animations**: Framer Motion + canvas-confetti

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the following schema:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  input_name TEXT NOT NULL,
  found_name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  added_by UUID REFERENCES session_users(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES session_users(id) ON DELETE CASCADE,
  score INTEGER CHECK (score BETWEEN 1 AND 3),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);
```

4. Enable Realtime for all four tables: go to **Database → Publications**, click on **`supabase_realtime`**, and toggle on `sessions`, `session_users`, `restaurants`, and `votes`.

### 2. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project
2. Enable the **Places API (New)**
3. Create an API key under **APIs & Services → Credentials**

### 3. Configure Environment Variables

Copy your Supabase project URL and anon key from **Project Settings → API**, then create `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

### 4. Run the App

```bash
npm install
npm run dev
```

## How to Play

1. **User 1** opens the app and clicks **Create Session** — note the 6-character code shown
2. **User 2** opens the app on their device, clicks **Join Session**, and enters the code
3. Both users enter their names
4. Either user sets the shared location — type a city, neighborhood, or address and pick from the autocomplete suggestions, or use GPS
5. Either user can add restaurants by typing a name and selecting from the autocomplete dropdown — results are sorted by distance from the shared location
6. Both users vote on each restaurant: **🥇 1** (top pick), **🥈 2** (okay), **🥉 3** (last resort)
7. The list auto-sorts by combined vote score in real-time
8. When both users vote **1** on the same restaurant — confetti fires and a **Get Directions** button appears 🎉

## Notes

- Supabase free projects pause after 7 days of inactivity — just re-activate from the dashboard
- Restaurant search is biased to within ~31 miles of the shared location
- The app works on mobile; on small screens the map is above and the list is below
