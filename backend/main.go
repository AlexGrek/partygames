package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"strings"

	bolt "go.etcd.io/bbolt"
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
	return strings.TrimPrefix(r.URL.Path, "/api/v1/keys/")
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

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dbPath := flag.String("db", "data.db", "path to bbolt database file")
	flag.Parse()

	var err error
	db, err = bolt.Open(*dbPath, 0600, nil)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/keys", handleKeys)
	mux.HandleFunc("/api/v1/keys/", handleKeys)

	log.Printf("listening on %s, db: %s", *addr, *dbPath)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
