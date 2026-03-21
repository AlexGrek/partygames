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

### Docker & Deploy
```sh
make docker-push   # build frontend locally, build linux/amd64 image, push to Docker Hub,
                   # and update helm/partygames/values.yaml tag to the current git short hash
make helm-upgrade  # helm upgrade --install (shortcut)
make deploy        # docker-push + helm-upgrade in one shot
```
Image is tagged `grekodocker/partygames:<short-commit>`. The Makefile derives the tag from
`git rev-parse --short HEAD` and passes it to Helm via `--set image.tag=<commit>` at deploy time.
`values.yaml` keeps `tag: latest` as a placeholder and is never modified during deploy.

**Deploy loop — always follow this order:**
1. `git commit` — commit all changes first; the image tag is the HEAD hash
2. `make deploy` — builds frontend, pushes image, runs helm upgrade with the correct tag

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

## DevOps Role

### Goals
- **Deployment simplicity** — one command (`make deploy`) takes you from committed code to running pod. No manual steps, no copy-pasting.
- **Minimal image size** — multi-stage Dockerfile: Go compiled in `golang:alpine`, final image is `alpine` with only the static binary + frontend assets. No build tools, no shell scripts in prod.
- **amd64 for production, arm64 for Mac debugging** — `make deploy` always targets `linux/amd64` (Kubernetes cluster). Use `docker build --platform linux/arm64` locally if you need to debug the container on Apple Silicon without QEMU overhead.

### Known gotchas

**YAML parses all-numeric git hashes as integers.**
Helm values read `tag: 9148287` as the integer 9148287, which renders as `9.148287e+06` — an invalid image name. The sed in `make docker-push` writes the tag unquoted; if the short hash happens to be all digits, quote it manually in `values.yaml` (`tag: "9148287"`) or re-run after the next commit adds a letter.

**StatefulSet pods do not self-heal during CrashLoopBackOff.**
A rolling update won't replace a pod that is crashing. If a pod is stuck on a bad spec, delete it manually (`kubectl delete pod <name> -n partygames`) to force the StatefulSet to recreate it with the current spec.

**`args` without `command` in Kubernetes replaces `CMD` entirely.**
The Dockerfile uses `CMD ["./server", ...]` (no `ENTRYPOINT`). If the Helm template sets only `args:`, Kubernetes replaces the whole CMD and tries to exec the first arg as a binary. The StatefulSet template must set `command: ["./server"]` alongside `args:`.
