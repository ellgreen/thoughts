# UI Build
FROM node:22-alpine AS ui-build

WORKDIR /app/ui

RUN corepack enable

COPY ui/package.json ui/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY ./ui/ .

RUN pnpm build

# Go Build
FROM golang:1.23-alpine AS build

RUN apk add gcc g++

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download && go mod verify

COPY migrations /app/migrations
COPY cmd /app/cmd
COPY --from=ui-build /app/ui/dist /app/ui/dist
COPY ui/*.go /app/ui/

RUN CGO_ENABLED=0 go build -tags bundled -o /thoughts ./cmd/thoughts

# Final Image
FROM alpine:latest

LABEL org.opencontainers.image.source="https://github.com/ellgreen/thoughts"

COPY --from=build /thoughts /usr/local/bin/

RUN mkdir -p /data

EXPOSE 3000

CMD ["thoughts", "-addr", ":3000"]
