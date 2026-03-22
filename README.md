# Party Games

A self-hosted party game platform with a React SPA frontend and a Go backend. All data persists in an embedded bbolt database. Deploy as a single Docker container.

Live: **partygames.alexgr.space**

---

## Party Apps

### 🐊 CrocoDildo 30+
Ukrainian word-guessing game where one player explains words to others without saying them.

- 5 difficulty levels (Easy → Impossible), based on word length
- Letters reveal one by one with animation; 3-second grace period before timer starts
- AI-powered word explanation (via OffloadMQ LLM integration) shown after the round
- Remembers which words have been shown; can reset per level
- Word lists and LLM prompts are configurable via the Croc Editor and DB

### 🎰 SlopMachine
Emoji slot machine.

- 8 emoji packs: Slop Classics, Faces, Office, Vibey Office, Office Signs, Medieval, Space, Food
- Spin by pressing any key
- Per-reel bias system with freespin bias

### 🎶 Guess the Melody
Song-guessing game — play a clip and let players guess the track.

- Category-based song library managed via Melody Editor
- 3-second countdown before audio plays
- Configurable first-guess delay (progress bar) so the host can give everyone a fair chance
- Reveals title and artist after round ends
- Supports audio and video files; tracks guessed songs to avoid repeats

---

## Utility Apps

### 🗄️ DB Viewer
Full KV database editor in the browser.

- Tree view of keys organised by `::` namespace hierarchy
- Create, edit (JSON), and delete keys
- Collapsible groups with item counts

### 📁 Files
In-browser file manager backed by WebDAV.

- Upload via button or drag-and-drop
- Preview images, audio, and video inline
- Create folders, download, delete, navigate directories
- Breadcrumb navigation with file size and modification time

### ✏️ Croc Editor
Word list manager for the Crocodile game.

- Five level tabs (Easy → Impossible) + a Checkup tab
- Toggle between form mode (one word at a time) and YAML bulk-edit mode
- Auto-saves on tab switch
- Detects duplicates and capitalisation issues (with auto-fix)
- Move words between levels; shows word count per level

### ✨ Melody Editor
Song library manager for the Melody game.

- Upload audio or video files; auto-parses `Artist - Title [YouTubeID]` filenames
- Edit title, artist, and category per track
- Inline audio preview
- First-guess-delay slider
- Saves to `melody::categories`, `melody::items`, `melody::first-guess-delay` in DB

### ⚡ OffloadMQ
UI for the OffloadMQ remote task queue used by other apps for LLM inference.

- Debug echo, shell runner, Docker runner, LLM inference (Ollama), and storage buckets
- Proxied through the backend (API key injected server-side)

---

## Backend

Single-file Go HTTP server (`backend/main.go`) using only the standard library and bbolt.

### API — `/api/v1`

#### Key-Value store — `/api/v1/keys`
All app config and word lists live here.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/keys` | List all keys (`?prefix=` filter supported) |
| GET | `/api/v1/keys/{key}` | Get a JSON value |
| PUT | `/api/v1/keys/{key}` | Set a JSON value |
| DELETE | `/api/v1/keys/{key}` | Delete a key |

Storage: single bbolt bucket `"kv"`. Values are raw JSON bytes. CORS is open (all origins).

#### Files — `/api/v1/files`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/files` | JSON directory listing (`?path=` for subdirectory) |
| WebDAV | `/api/v1/files/*` | PROPFIND, MKCOL, PUT, DELETE for browser file management |

#### OffloadMQ proxy — `/api/v1/offloadmq/*`
Reverse-proxies to `offloadmq.alexgr.space`. Injects `X-API-Key` header and `apiKey` JSON field from server environment so the API key never reaches the browser.

### DB key namespaces

| Prefix | Used by |
|--------|---------|
| `croc::words-level-{1-5}` | Crocodile word lists per difficulty |
| `croc::explain-*` | LLM capability, request template, system prompt |
| `croc::explanation::{word}` | Cached LLM explanations |
| `melody::categories` | Melody category list |
| `melody::items` | Melody song library |
| `melody::first-guess-delay` | Delay (ms) before guessing opens |

### Server flags

| Flag | Default | Description |
|------|---------|-------------|
| `-addr` | `:8080` | Listen address |
| `-db` | `data.db` | bbolt database file path |
| `-static` | *(unset)* | Directory to serve as frontend; omit for API-only mode |

### SPA fallback
Unknown paths fall through to `index.html` so React Router client-side navigation works in production.

---

## Development

```sh
make dev          # Vite on :5173, proxies /api/v1 → :8080
make run-backend  # Go server on :8080 with local data.db
```

## Deploy

```sh
git commit        # image tag = HEAD short hash
make deploy       # build frontend → build image → push → helm upgrade
```

Image: `grekodocker/partygames:<short-commit>`. Runs as a Kubernetes StatefulSet with a 1 Gi PVC at `/data`; the database lives at `/data/data.db` and survives redeployments.
