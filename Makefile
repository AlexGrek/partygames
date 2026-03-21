COMMIT := $(shell git rev-parse --short HEAD)
IMAGE  := grekodocker/partygames:$(COMMIT)

.PHONY: dev build-frontend build-backend run-backend docker-push helm-upgrade deploy

dev:
	@pkill -f 'go run ./backend' 2>/dev/null || true
	@pkill -f 'backend/server' 2>/dev/null || true
	go run ./backend/main.go -addr :8080 -db data.db &
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

build-backend:
	go build -o backend/server ./backend/main.go

run-backend:
	go run ./backend/main.go -addr :8080 -db data.db

docker-push: build-frontend
	docker buildx build --platform linux/amd64 -t $(IMAGE) --push .
	@echo "Pushed $(IMAGE)"

helm-upgrade:
	helm upgrade --install partygames ./helm/partygames -n partygames --create-namespace --set image.tag=$(COMMIT)

deploy: docker-push helm-upgrade
