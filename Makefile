.PHONY: dev build-front run-backend build-backend

dev:
	cd frontend && npm run dev

build-front:
	cd frontend && npm run build

run-backend:
	go run ./backend/main.go -addr :8080 -db data.db

build-backend:
	go build -o backend/server ./backend/main.go
