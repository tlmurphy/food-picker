# Food Picker — Claude Instructions

Food Picker is a real-time collaborative restaurant voting app. Multiple users join a session, add nearby restaurants, and vote — the app picks a winner when everyone agrees.

## Node / Bun Environment

Before running any Node or Bun commands, always source nvm and select the project Node version:

```bash
source ~/.nvm/nvm.sh && nvm use lts/krypton
```

Use the full path for bun since it is not on PATH via nvm: `~/.bun/bin/bun`

## Dev Commands

```bash
~/.bun/bin/bun run dev          # Vite (port 5173) + Bun server (port 3001) concurrently
~/.bun/bin/bun run dev:server   # Bun server only
~/.bun/bin/bun run dev:client   # Vite only
~/.bun/bin/bun run build        # tsc + vite build → dist/
~/.bun/bin/bun run test         # vitest (watch)
~/.bun/bin/bun run test:run     # vitest (single run)
~/.bun/bin/bun run lint         # biome check
~/.bun/bin/bun run lint:fix     # biome check with auto-fix
```

Run `bun install` after any package.json changes.

## Architecture

- **Frontend**: React + Vite + TypeScript, served from `dist/` by the Bun server in production
- **Backend**: Bun HTTP + WebSocket server (`server/index.ts`) — no database, sessions are in-memory
- **Sessions are ephemeral**: cleaned up 60s after last disconnect; no persistence
- **Single deployment**: Railway serves static build + WebSocket + Google Maps proxy from one URL
- Vite proxies `/ws` and `/api/*` to `localhost:3001` in dev

## Key Conventions

- `shared/types.ts` is the single source of truth for all domain + WebSocket message types — used by both server and frontend. Always update types here first.
- All type fields are **camelCase** throughout (`locationLat`, `foundName`, `userId`, etc.)
- WebSocket protocol: clients send action messages, server broadcasts state events back

## Environment Variables

| Variable | Where set | Notes |
|---|---|---|
| `VITE_WS_URL` | **Build time** (Vite bakes it in) | Dev: `ws://localhost:5173/ws` · Prod: `wss://your-app.up.railway.app/ws` |
| `GOOGLE_MAPS_API_KEY` | Server runtime | No `VITE_` prefix — server-side only |
| `PORT` | Server runtime | Set automatically by Railway |

`VITE_WS_URL` must be a Railway build variable, not a runtime env var.

## Before Committing

Always run lint:fix before committing to avoid lint errors:

```bash
~/.bun/bin/bun run lint:fix
```

## Testing

- Runner: **vitest** with **happy-dom** environment (configured in `vite.config.ts`)
- Test files: `*.test.ts` / `*.test.tsx` colocated with source or in `server/`
- Globals enabled — no need to import `describe`, `it`, `expect`
