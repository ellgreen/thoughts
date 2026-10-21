# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:26-alpine AS ui
WORKDIR /src/ui
RUN npm install --global pnpm@11.24.0
COPY ui/package.json ui/pnpm-lock.yaml ui/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY ui/ ./
RUN pnpm build

FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS go
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=ui /src/internal/web/dist ./internal/web/dist
ARG TARGETOS TARGETARCH VERSION=dev
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -tags bundled -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/thoughts ./cmd/thoughts

# Root, like v1's image: volumes v1 wrote are owned by root, and a non-root
# v2 couldn't open them after an upgrade. Run with --user to opt out.
FROM gcr.io/distroless/static-debian13
COPY --from=go /out/thoughts /usr/local/bin/thoughts
ENV THOUGHTS_ADDRESS=":3000" \
    THOUGHTS_DATA_PATH="/data" \
    THOUGHTS_LOG_FORMAT="json"
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/thoughts"]
