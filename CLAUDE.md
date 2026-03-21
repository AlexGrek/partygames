# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`frontend/`)
```sh
make dev              # start Vite dev server (React Router)
make build-front      # production build
cd frontend && npm run typecheck  # TypeScript type check
```

### Backend (`backend/`)
```sh
make run-backend      # go run with default flags (-addr :8080 -db data.db)
make build-backend    # compile to backend/server binary
cd backend && go build ./...   # verify compilation
cd backend && go mod tidy      # sync dependencies
```

## Architecture

This is a two-process application — a Go HTTP backend and a React SPA — with no shared build pipeline.

### Backend (`backend/main.go`)
Single-file Go server. Uses **bbolt** (embedded BoltDB) as the KV store; no external database process is needed. Data is persisted to a local file (`data.db` by default). All keys and values live in a single bbolt bucket named `"kv"`. Values are stored and returned as raw JSON bytes.

HTTP is handled by the standard library `net/http`. CORS headers (`Access-Control-Allow-Origin: *`) are set on every handler to allow the frontend dev server to call the API directly.

API is documented in `backend/API.md`. All routes live under `/api/v1/keys`.

### Frontend (`frontend/`)
React Router v7 running in **SPA mode** (`ssr: false`). Routes are declared in `app/routes.ts` and implemented as files in `app/routes/`. The root layout (`app/root.tsx`) applies the global dark theme (`bg-neutral-950 text-white`).

Styling is **Tailwind CSS v4** (imported via `@tailwindcss/vite` — no `tailwind.config.js` needed). Animations use **framer-motion**, icons use **lucide-react**.

The frontend calls the backend directly at `http://localhost:8080/api/v1` (hardcoded in `app/routes/db.tsx`). There is no proxy configured in Vite.

### Adding a new route
1. Create `app/routes/<name>.tsx` with a default export component.
2. Register it in `app/routes.ts` with `route("<path>", "routes/<name>.tsx")`.
3. Optionally link from `app/routes/home.tsx`.
