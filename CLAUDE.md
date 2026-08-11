# CLAUDE.md

Thoughts is a self-hosted, real-time collaborative retrospective tool: a Go
backend serving a React/TypeScript SPA. In production the binary embeds the
built UI; in development the two run separately.

## Commands

```bash
task dev        # Hot-reload backend (Air, watches *.go + migrations/)
task build      # Bundles the UI, then compiles with -tags bundled
task run        # Build and run the production binary
task tools      # Installs goose + goreleaser
```

```bash
cd ui
pnpm run dev    # Vite on :5173, proxying /api/* to :3000
pnpm run build
pnpm run lint
pnpm test
```

Before saying a change is done:

```bash
go build ./... && go vet ./... && go test ./...
cd ui && pnpm lint && pnpm exec tsc -b && pnpm test && pnpm build
```

## Architecture

```
cmd/thoughts/
├── main.go          Server setup, DB init, migration runner
├── config.go        Viper config — every env var is defined here
├── routes.go        All route registration (applyRoutes)
├── controllers/     HTTP handlers
├── model/           Entity structs (Retro, Note, Vote, Task, User)
├── dal/             Raw sqlx queries, no ORM, one file per entity
├── resources/       Outbound DTOs
├── requests/        Inbound DTOs with go-playground/validator tags
├── event/           Pub/sub broker for WebSocket events
├── socket/          WebSocket upgrade and message dispatch
├── session/         Gorilla session management
├── auth/            Session cookie middleware
├── ai/              OpenAI via langchaingo
└── gif/             GIF search behind a swappable provider
```

HTTP requests flow routes → auth middleware → controller → DAL → SQLite.
Real-time updates flow `event.Broker` → WebSocket → frontend.

Migrations live in `migrations/*.sql` with `-- +goose Up` / `-- +goose Down`,
are embedded with `//go:embed`, and run automatically on startup.

Frontend routing is TanStack Router, file-based under `ui/src/routes/`. HTTP is
axios, the socket is react-use-websocket, shared state is React context in
`ui/src/hooks/`.

## Conventions

Config is environment variables with a `THOUGHTS_` prefix, defaulted in
`config.go`. `THOUGHTS_GIF_API_KEY` and `THOUGHTS_GIF_PROVIDER` control GIF
search; pasting a link works without either. `THOUGHTS_OPENAI_API_KEY` enables
AI template generation.

Never return a model struct from a handler; map it through `resources/`.

When a mutation should reach other people in the retro, publish to
`event.Broker` after the DAL write. Payloads are `map[string]any` and are
decoded by `requests.FromMap`, which handles only flat scalars — no nested
structs or slices of structs.

Auth is name-only, no passwords. **A name is a label, not an account.** Each
login creates a new user row, so two people called Alex are two people, and one
person entering their name twice gets two sessions. Do not add uniqueness to
`users.name` or try to reuse a row by name.

## Writing code here

Match the surrounding code. Prefer clear naming and small functions over
explanation.

**Comment sparingly.** The bar is: would a competent reader be surprised, or
reintroduce the problem, without this? If not, leave it out.

Worth a comment:

- A workaround for a library or browser quirk, naming it.
- Why an obvious-looking alternative was rejected.
- A constant that has to stay in step with something elsewhere.

Not worth a comment:

- Anything the code already says. No `// Set the title` above a title being set.
- Narrating a component's structure, or restating a name in prose.
- Justifying a design choice that no one would question.
- Section headers inside a function.

Keep them to a line or two. A doc comment on an exported symbol should say what
it is for, not how it works. Do not add a comment to every branch of a switch,
every prop in an interface, or every step of a sequence.

## Verifying

Run the app and check the change rather than assuming it works. Where a claim
cannot be verified — because the tooling cannot drive the interaction, or no key
is available — say so plainly rather than implying it was tested.

A test written from documentation proves the code agrees with the documentation,
not with reality. Where an external API is involved, shape fixtures from a real
response and keep a live contract test behind an env var.
