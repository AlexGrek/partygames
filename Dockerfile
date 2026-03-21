FROM --platform=linux/amd64 golang:1.25-alpine AS builder

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server .

FROM --platform=linux/amd64 alpine:3.20

WORKDIR /app
COPY --from=builder /app/server ./server
COPY frontend/build/client/ ./static/

VOLUME ["/data"]
EXPOSE 8080

CMD ["./server", "-addr=:8080", "-db=/data/data.db", "-static=./static"]
