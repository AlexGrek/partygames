# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```sh
make dev              # Vite dev server on :5173 (proxies /api/v1 → :8080)
make run-backend      # Go server on :8080 with local data.db
```

### Frontend
```sh
make build-frontend               # npm run build → frontend/build/client/
cd frontend && npm run typecheck  # TypeScript check
```

### Backend
```sh
make build-backend          # compile to backend/server
cd backend && go build ./... # verify compilation
cd backend && go mod tidy   # sync dependencies
```

### Docker
```sh
make docker-push  # build frontend locally, build linux/amd64 image, push to Docker Hub,
                  # and update helm/partygames/values.yaml tag to the current git short hash
```
Image is tagged `grekodocker/partygames:<short-commit>`. The Makefile derives the tag from
`git rev-parse --short HEAD` and writes it into `helm/partygames/values.yaml` automatically.

### Helm
```sh
helm upgrade --install partygames ./helm/partygames -n partygames --create-namespace
```

## Architecture

### Runtime (production)
Frontend and backend ship as a **single Docker image** (`grekodocker/partygames:<commit>`).
The Go binary serves both the REST API (`/api/v1/`) and the React SPA static files (`/`).
Unknown paths fall back to `index.html` so client-side routing works (see `spaHandler` in `backend/main.go`).

```
Browser → Ingress (Traefik) → partygames Service → partygames StatefulSet pod
                                                         ├── /api/v1/  →  bbolt KV
                                                         └── /         →  ./static/ (SPA)
```

### Development
Two separate processes. Vite proxies `/api/v1` to `:8080` (configured in `frontend/vite.config.ts`),
so the frontend uses relative URLs (`/api/v1`) in all environments.

### Backend (`backend/main.go`)
Single-file Go HTTP server using stdlib `net/http`. Flags:
- `-addr` — listen address (default `:8080`)
- `-db` — path to bbolt database file (default `data.db`)
- `-static` — directory to serve as frontend; omit to run API-only (used in local dev)

All KV data lives in a single bbolt bucket named `"kv"`. Values are raw JSON bytes.
API documented in `backend/API.md`, all routes under `/api/v1/keys`.

### Frontend (`frontend/`)
React Router v7 in **SPA mode** (`ssr: false`). Routes declared in `app/routes.ts`, implemented
in `app/routes/`. Root layout in `app/root.tsx` sets the global dark theme.
Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`). Icons: lucide-react. Animations: framer-motion.

Build output: `frontend/build/client/` — this directory is gitignored and copied into the Docker image.

### Adding a new route
1. Create `app/routes/<name>.tsx` with a default export component.
2. Register in `app/routes.ts`: `route("<path>", "routes/<name>.tsx")`.
3. Optionally link from `app/routes/home.tsx`.

## Kubernetes / Helm

Chart lives at `helm/partygames/`. Deploys to host `partygames.alexgr.space` with Traefik ingress and cert-manager TLS (`letsencrypt-prod`).

### Persistence
The app runs as a **StatefulSet** (not a Deployment) so the pod gets a stable identity and a dedicated PVC.
`volumeClaimTemplates` provisions a `ReadWriteOnce` PVC (default 1Gi) mounted at `storage.mountPath` (`/data`).
The bbolt database is written to `<mountPath>/data.db`. The PVC is **not deleted** on helm uninstall — data survives pod restarts, rescheduling, and redeployments.

Container `args` in the StatefulSet are templated from `values.yaml` so `-db` always points to the mounted path:
```yaml
args:
  - -addr=:{{ .Values.service.targetPort }}
  - -db={{ .Values.storage.mountPath }}/data.db
  - -static=./static
```

### Key values
| Value | Default | Purpose |
|-------|---------|---------|
| `image.tag` | `latest` | Updated automatically by `make docker-push` |
| `storage.mountPath` | `/data` | PVC mount path and db directory |
| `storage.size` | `1Gi` | PVC size |
| `ingress.host` | `partygames.alexgr.space` | Ingress hostname |

### Docker build notes
- `make docker-push` builds the frontend on the host (avoids slow QEMU emulation on Apple Silicon).
- The image is always built for `linux/amd64` via `docker buildx --platform linux/amd64`.
- The Go binary is compiled with `CGO_ENABLED=0` for a fully static binary compatible with `alpine`.
