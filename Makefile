COMMIT := $(shell git rev-parse --short HEAD)
IMAGE  := grekodocker/partygames:$(COMMIT)

.PHONY: dev build-frontend build-backend run-backend docker-push helm-upgrade deploy

dev:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

build-backend:
	go build -o backend/server ./backend/main.go

run-backend:
	go run ./backend/main.go -addr :8080 -db data.db

docker-push: build-frontend
	docker buildx build --platform linux/amd64 -t $(IMAGE) --push .
	sed -i '' 's/^  tag:.*/  tag: $(COMMIT)/' helm/partygames/values.yaml
	@echo "Pushed $(IMAGE) and updated helm/partygames/values.yaml"

helm-upgrade:
	helm upgrade --install partygames ./helm/partygames -n partygames --create-namespace

deploy: docker-push helm-upgrade
