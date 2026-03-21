# etcd Key-Value API

Base URL: `http://localhost:8080`

All request and response bodies are `application/json`.
Keys are plain strings. Values are any valid JSON (object, array, string, number, bool, null).

---

## Endpoints

### List keys

```
GET /api/v1/keys
```

Optional query parameter: `prefix=<string>` — filter keys by prefix.

**Response 200**
```json
{ "keys": ["game:1", "game:2"] }
```

---

### Get value

```
GET /api/v1/keys/{key}
```

**Response 200**
```json
{ "key": "game:1", "value": { "name": "trivia", "players": 4 } }
```

**Response 404**
```json
{ "error": "key not found" }
```

---

### Set value

```
PUT /api/v1/keys/{key}
Content-Type: application/json
```

Body: any valid JSON value.

```json
{ "name": "trivia", "players": 4 }
```

**Response 200**
```json
{ "key": "game:1" }
```

**Response 400**
```json
{ "error": "body must be valid JSON" }
```

---

### Delete key

```
DELETE /api/v1/keys/{key}
```

**Response 200**
```json
{ "key": "game:1", "deleted": true }
```

**Response 404**
```json
{ "error": "key not found" }
```

---

## Running

```sh
go run ./backend/main.go \
  -addr :8080 \
  -db data.db
```

Flags:
- `-addr` — HTTP listen address (default `:8080`)
- `-db` — path to the bbolt database file (default `data.db`)

## CORS

All origins are allowed (`Access-Control-Allow-Origin: *`), so the frontend can call the API directly from the browser.
