# Party Games

A web app for playing party games together. Built with a React frontend and a Go backend backed by an embedded key-value store.

## Stack

- **Frontend** — React Router v7 (SPA), Tailwind CSS v4, TypeScript
- **Backend** — Go, [bbolt](https://github.com/etcd-io/bbolt) embedded KV store
- **No external database** — data persists to a local `data.db` file

## Games

- 🐊 **Crocodile** — coming soon
- 🎰 **SlopMachine** — coming soon

## Development

Start both services in separate terminals:

```sh
# Frontend (http://localhost:5173)
make dev

# Backend (http://localhost:8080)
make run-backend
```

## Backend API

REST API documented in [`backend/API.md`](backend/API.md). All routes are under `/api/v1/keys`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/keys` | List all keys |
| GET | `/api/v1/keys/{key}` | Get value |
| PUT | `/api/v1/keys/{key}` | Set value (JSON body) |
| DELETE | `/api/v1/keys/{key}` | Delete key |

## Build

```sh
make build-front    # React production build → frontend/build/
make build-backend  # Go binary → backend/server
```
