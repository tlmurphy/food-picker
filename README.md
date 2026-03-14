# Food Picker

A collaborative restaurant-picking app for groups on separate devices. Add restaurants, vote on them, and let the app decide — with a coin flip if there's a tie.

See an example of this project deployed on https://food-picker.up.railway.app/

## Tech Stack

- **Frontend**: React + Vite + TypeScript + React Router
- **Backend**: Bun WebSocket server (in-memory, no database)
- **Map**: Leaflet.js + OpenStreetMap (free, no API key required)
- **Restaurant & location search**: Google Places API (New) — autocomplete + place details
- **Animations**: Framer Motion + canvas-confetti
- **Notifications**: Sonner (toasts)
- **Linting/formatting**: Biome
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
GOOGLE_MAPS_API_KEY=AIza...
```

**Testing on other devices (e.g. phone on same network):**

Replace `localhost` with your machine's LAN IP so the WebSocket connects to the right host:

```
VITE_WS_URL=ws://192.168.x.x:5173/ws
```

### 3. Install and Run

```bash
bun install
bun run dev
```

This starts both the Vite dev server (port 5173) and the Bun WebSocket server (port 3001) concurrently. Open **`http://localhost:5173`** in your browser — not 3001, which is the backend only.

## Testing

```bash
bun run test        # run in watch mode
bun run test:run    # single run (CI-friendly)
bun run test:ui     # open vitest UI in browser
```

### Linting

```bash
bun run lint        # check for issues
bun run lint:fix    # auto-fix issues
```

Tests use [vitest](https://vitest.dev) with a `happy-dom` environment. No additional setup required — test files live alongside their source files as `*.test.ts` / `*.test.tsx`.

### E2E Tests

```bash
bun run test:e2e       # run headless
bun run test:e2e:ui    # open Playwright UI
```

E2E tests use [Playwright](https://playwright.dev) and require Chromium. Install it once before running:

```bash
bunx playwright install chromium
```

All Google Maps API calls are intercepted with mocks — no API key needed to run the tests. The dev server starts automatically when the tests run.

## Deployment (Railway)

1. Push the repo to GitHub
2. Create a new project on [Railway](https://railway.com) and connect the GitHub repo
3. Set the following environment variables in the Railway dashboard:
   - **Build variable**: `VITE_WS_URL=wss://your-app.up.railway.app/ws` (must be set before build — Vite bakes it into the client bundle)
   - **Runtime variable**: `GOOGLE_MAPS_API_KEY=AIza...` (no `VITE_` prefix — server-side only, never exposed to the browser)
   - **Runtime variable**: `RAILWAY_PUBLIC_DOMAIN` is auto-set by Railway (e.g., `your-app.up.railway.app`) — the server uses it to validate WebSocket origins. If you use a custom domain, set this to your custom domain instead.
4. Railway auto-deploys on every push to `main`

The single Railway service serves the static React build, handles WebSocket connections, and proxies Google Maps requests — all from one URL.

## How to Play

1. **User 1** opens the app and clicks **Create Session** — note the 10-character session code
2. **User 2** (and any additional players) opens the app, clicks **Join Session**, and enters the code
3. All users enter their names
4. Either user sets the shared location — type a city, neighborhood, or address and pick from the autocomplete suggestions, or use GPS
5. Any user can add restaurants by typing a name and selecting from the autocomplete dropdown — results are sorted by distance from the shared location
6. Users vote on restaurants by tapping the thumbs up button; votes are visible to everyone in real time
7. The list auto-sorts by vote count
8. When you're ready to decide, tap **Pick Now!** — the top-voted restaurant wins. If multiple restaurants are tied, a **Coin Flip!** bracket eliminates them one by one until a winner is chosen
9. Confetti fires and a **Get Directions** button appears — opens Apple Maps on iOS, Google Maps everywhere else

## Notes

- Sessions are ephemeral — all data lives in memory and is lost when the server restarts or after 30 seconds of inactivity
- Restaurant search is biased to within ~6 miles of the shared location
- The map is accessible via **View Map** and opens as a full-screen overlay with all added restaurants pinned
