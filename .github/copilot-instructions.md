# Copilot Instructions

## Project Overview

**Thoughts** is a self-hosted, real-time collaborative retrospective tool. It's a full-stack app with a Go backend and a React/TypeScript frontend. The backend serves the bundled UI in production but runs separately during development.

## Commands

### Backend

```bash
task dev        # Hot-reload dev server (uses Air, watches *.go + migrations/)
task build      # Production build — bundles UI first, then compiles with -tags bundled
task run        # Build + run production binary
```

### Frontend

```bash
cd ui
pnpm install
pnpm run dev    # Vite dev server on :5173, proxies /api/* to :3000
pnpm run build  # Produces ui/dist/ (required before task build)
pnpm run lint
```

### Database migrations

Migrations run automatically on startup via Goose. To manage manually:

```bash
task tools      # Installs goose + goreleaser
```

Migration files live in `migrations/*.sql` using `-- +goose Up` / `-- +goose Down` directives. They are embedded into the binary via `//go:embed` in `migrations/migrations.go`.

### Docker

```bash
task docker-build
task docker-run
```

## Architecture

```
cmd/thoughts/
├── main.go          # Server setup, DB init, migration runner
├── config.go        # Viper config — all env vars defined here
├── routes.go        # All route registration (applyRoutes)
├── controllers/     # HTTP handlers
├── model/           # Entity structs (Retro, Note, Vote, Task, User)
├── dal/             # Data Access Layer — raw sqlx queries, no ORM
├── resources/       # Response DTOs (JSON serialization)
├── requests/        # Request DTOs with go-playground/validator tags
├── event/           # Pub/sub broker for WebSocket events
├── socket/          # WebSocket upgrade + message dispatch
├── session/         # Gorilla session management
├── auth/            # Auth middleware (checks session cookie)
├── ai/              # OpenAI integration via langchaingo
└── gif/             # Tenor API integration
```

**Request flow:** HTTP → `routes.go` → auth middleware → controller → DAL → SQLite. Real-time updates flow via `event.Broker` → WebSocket → frontend.

**Production build:** `task build-ui` generates `ui/dist/`, then `go build -tags bundled` embeds the dist into the binary and serves it as a static filesystem.

## Key Conventions

### Configuration

All config is via environment variables with the `THOUGHTS_` prefix, managed by Viper. Defaults are set in `config.go`. Key variables:

| Variable | Default | Notes |
|---|---|---|
| `THOUGHTS_ADDRESS` | `localhost:3000` | HTTP listen address |
| `THOUGHTS_DATA` | `./data` | SQLite + session key location |
| `THOUGHTS_OPENAI_API_KEY` | _(unset)_ | Enables AI template generation |
| `THOUGHTS_TENOR_API_KEY` | _(unset)_ | Enables GIF search |
| `THOUGHTS_TLS_CERT_PATH` / `THOUGHTS_TLS_KEY_PATH` | _(unset)_ | Optional TLS |

### Layered request/response pattern

- **Requests** (`requests/`) — bind and validate incoming JSON using `go-playground/validator` struct tags
- **Model** — internal entities used in DAL and business logic
- **Resources** (`resources/`) — outbound DTOs; never expose model structs directly in responses

### DAL

No ORM. Use `sqlx` directly. Queries are inline SQL strings. Follow the existing pattern of one file per entity (e.g., `dal/retros.go`, `dal/notes.go`).

### Real-time events

When a mutation should notify other clients in a retro session, publish to `event.Broker` after the DAL write. The event payload is `map[string]any`. Event name constants are defined in `event/`. The WebSocket handler in `socket/` routes incoming messages and the broker fan-outs to all connected clients for that retro.

### Authentication

Session-based (Gorilla Sessions, cookie-backed). The session key is auto-generated and persisted to `data/session.key` on first run. Auth is name-only — no passwords. The `auth.Middleware()` in `routes.go` wraps all `/api/*` routes except `/api/auth/`.

### Frontend routing

TanStack Router with file-based routes under `ui/src/routes/`. API calls use `axios`. WebSocket connection managed by `react-use-websocket`. Global state (auth, theme) via React Context in `ui/src/hooks/`.
