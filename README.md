# Food Picker

A collaborative restaurant-picking app for two users on separate devices. Add restaurants, vote on them, and get directions when you both agree.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Bun WebSocket server (in-memory, no database)
- **Map**: Leaflet.js + OpenStreetMap (free, no API key)
- **Restaurant search & autocomplete**: Google Places API (New)
- **Location autocomplete**: Google Places API (New)
- **Animations**: Framer Motion + canvas-confetti
- **Deployment**: Railway

## Setup

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project
2. Enable the **Places API (New)**
3. Create an API key under **APIs & Services → Credentials**

### 2. Configure Environment Variables

Create `.env.local`:

```
VITE_WS_URL=ws://localhost:5173/ws
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

### 3. Install and Run

```bash
bun install
bun run dev
```

This starts both the Vite dev server (port 5173) and the Bun WebSocket server (port 3001) concurrently.

## Deployment (Railway)

1. Push the repo to GitHub
2. Create a new project on [Railway](https://railway.com) and connect the GitHub repo
3. Set the following environment variables in the Railway dashboard:
   - **Build variable**: `VITE_WS_URL=wss://your-app.up.railway.app/ws` (must be set before build)
   - **Runtime variable**: `GOOGLE_MAPS_API_KEY=AIza...` (no `VITE_` prefix — server-side only)
4. Railway auto-deploys on every push to `main`

The single Railway service serves the static React build, handles WebSocket connections, and proxies Google Maps requests — all from one URL.

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

- Sessions are ephemeral — all data lives in memory and is lost when the server restarts or after 30 seconds of inactivity
- Restaurant search is biased to within ~31 miles of the shared location
- The app works on mobile; on small screens the map is above and the list is below
