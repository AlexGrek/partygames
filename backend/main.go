package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	bolt "go.etcd.io/bbolt"
	"golang.org/x/net/webdav"
)

var (
	db     *bolt.DB
	bucket = []byte("kv")
)

func errorResponse(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func extractKey(r *http.Request) string {
	key, _ := strings.CutPrefix(r.URL.Path, "/api/v1/keys/")
	if key == r.URL.Path {
		return ""
	}
	return key
}

func handleKeys(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	key := extractKey(r)

	if key == "" {
		if r.Method == http.MethodGet {
			listKeys(w, r)
		} else {
			errorResponse(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	switch r.Method {
	case http.MethodGet:
		getValue(w, r, key)
	case http.MethodPut:
		setValue(w, r, key)
	case http.MethodDelete:
		deleteValue(w, r, key)
	default:
		errorResponse(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// listKeys returns all keys in the store.
//
// GET /api/v1/keys
//
// Optional query parameter: prefix=<string>
//
// Response 200:
//
//	{ "keys": ["key1", "key2"] }
func listKeys(w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	var keys []string

	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, _ []byte) error {
			key := string(k)
			if prefix == "" || strings.HasPrefix(key, prefix) {
				keys = append(keys, key)
			}
			return nil
		})
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if keys == nil {
		keys = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"keys": keys})
}

// getValue returns the JSON value stored under a key.
//
// GET /api/v1/keys/{key}
//
// Response 200:
//
//	{ "key": "mykey", "value": { ...json... } }
//
// Response 404:
//
//	{ "error": "key not found" }
func getValue(w http.ResponseWriter, r *http.Request, key string) {
	var raw json.RawMessage

	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return nil
		}
		v := b.Get([]byte(key))
		if v == nil {
			return nil
		}
		raw = make([]byte, len(v))
		copy(raw, v)
		return nil
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if raw == nil {
		errorResponse(w, http.StatusNotFound, "key not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"key": key, "value": raw})
}

// setValue stores a JSON value under a key.
//
// PUT /api/v1/keys/{key}
// Content-Type: application/json
// Body: any valid JSON value (object, array, string, number, bool, null)
//
// Response 200:
//
//	{ "key": "mykey" }
//
// Response 400:
//
//	{ "error": "body must be valid JSON" }
func setValue(w http.ResponseWriter, r *http.Request, key string) {
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		errorResponse(w, http.StatusBadRequest, "body must be valid JSON")
		return
	}

	err := db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists(bucket)
		if err != nil {
			return err
		}
		return b.Put([]byte(key), raw)
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"key": key})
}

// deleteValue removes a key from the store.
//
// DELETE /api/v1/keys/{key}
//
// Response 200:
//
//	{ "key": "mykey", "deleted": true }
//
// Response 404:
//
//	{ "error": "key not found" }
func deleteValue(w http.ResponseWriter, r *http.Request, key string) {
	found := false

	err := db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucket)
		if b == nil {
			return nil
		}
		if b.Get([]byte(key)) != nil {
			found = true
			return b.Delete([]byte(key))
		}
		return nil
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !found {
		errorResponse(w, http.StatusNotFound, "key not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"key": key, "deleted": true})
}

// corsWebDAV wraps a handler with CORS headers suitable for WebDAV clients and browsers.
func corsWebDAV(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, DELETE, PROPFIND, MKCOL, COPY, MOVE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Depth, Destination, Overwrite, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "DAV, Content-Length, ETag")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// listFiles returns a JSON directory listing of the root of the files storage.
//
// GET /api/v1/files
//
// Response 200:
//
//	{ "files": [{ "name": "foo.txt", "size": 1234, "isDir": false, "modTime": "..." }] }
func listFiles(w http.ResponseWriter, r *http.Request, dir string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		errorResponse(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	subPath := r.URL.Query().Get("path")
	if subPath != "" {
		cleaned := filepath.Clean(subPath)
		absRoot, _ := filepath.Abs(dir)
		candidate := filepath.Join(absRoot, cleaned)
		absCandidate, _ := filepath.Abs(candidate)
		if absCandidate != absRoot && !strings.HasPrefix(absCandidate, absRoot+string(filepath.Separator)) {
			errorResponse(w, http.StatusBadRequest, "invalid path")
			return
		}
		dir = absCandidate
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	type FileEntry struct {
		Name    string `json:"name"`
		Size    int64  `json:"size"`
		IsDir   bool   `json:"isDir"`
		ModTime string `json:"modTime"`
	}

	files := []FileEntry{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, FileEntry{
			Name:    entry.Name(),
			Size:    info.Size(),
			IsDir:   entry.IsDir(),
			ModTime: info.ModTime().UTC().Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"files": files})
}

// spaHandler serves static files and falls back to index.html for unknown paths,
// enabling client-side routing in the SPA.
type spaHandler struct {
	dir        string
	fileServer http.Handler
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(h.dir, filepath.Clean("/"+r.URL.Path))
	if _, err := os.Stat(path); os.IsNotExist(err) {
		http.ServeFile(w, r, filepath.Join(h.dir, "index.html"))
		return
	}
	h.fileServer.ServeHTTP(w, r)
}

// seedDefaults writes a key only if it does not already exist in the bucket.
func seedDefaults(defaults map[string]interface{}) {
	err := db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists(bucket)
		if err != nil {
			return err
		}
		for k, v := range defaults {
			if b.Get([]byte(k)) != nil {
				continue // already set, leave it alone
			}
			raw, err := json.Marshal(v)
			if err != nil {
				return err
			}
			if err := b.Put([]byte(k), raw); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		log.Fatalf("failed to seed defaults: %v", err)
	}
}

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dbPath := flag.String("db", "data.db", "path to bbolt database file")
	staticDir := flag.String("static", "", "directory to serve as frontend (optional)")
	filesDir := flag.String("files", "", "directory to serve via WebDAV at /api/v1/files/ (optional)")
	flag.Parse()

	var err error
	db, err = bolt.Open(*dbPath, 0600, nil)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	seedDefaults(map[string]interface{}{
		"slop::spin-add-count":  []int{3, 5, 10},
		"slop::bias-factor-inc": 0.15,
		"croc::words-level-1":   []string{},
		"croc::words-level-2":   []string{},
		"croc::words-level-3":   []string{},
		"croc::words-level-4":   []string{},
		"croc::words-level-5":   []string{},
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/keys", handleKeys)
	mux.HandleFunc("/api/v1/keys/", handleKeys)

	if *filesDir != "" {
		if err := os.MkdirAll(*filesDir, 0755); err != nil {
			log.Fatalf("failed to create files directory: %v", err)
		}
		davHandler := &webdav.Handler{
			Prefix:     "/api/v1/files/",
			FileSystem: webdav.Dir(*filesDir),
			LockSystem: webdav.NewMemLS(),
		}
		mux.Handle("/api/v1/files/", corsWebDAV(davHandler))
		mux.HandleFunc("/api/v1/files", func(w http.ResponseWriter, r *http.Request) {
			listFiles(w, r, *filesDir)
		})
		log.Printf("serving files via WebDAV from %s at /api/v1/files/", *filesDir)
	}

	if *staticDir != "" {
		mux.Handle("/", spaHandler{
			dir:        *staticDir,
			fileServer: http.FileServer(http.Dir(*staticDir)),
		})
		log.Printf("serving frontend from %s", *staticDir)
	}

	log.Printf("listening on %s, db: %s", *addr, *dbPath)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
