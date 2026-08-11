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

Migrations are append-only once merged. A migration that changes or deletes
existing rows needs asking about first.

## Writing code here

Match the surrounding code. Prefer clear naming and small functions over
explanation.

### Comments

**The default is no comment.** Code that needs prose to be understood should be
rewritten instead. Most functions, types, props and exported symbols in this
repo have no comment, and that is correct — do not "improve" them by adding
one.

A comment has to earn its place by carrying information that is *not in the
code and not inferable from it*. In practice that is almost always one of:

- A library, browser or API quirk, named. *"popLayout clones each child with a
  ref of its own, which used to overwrite this one."*
- Why a reasonable-looking alternative is wrong here. *"A transaction is the
  wrong tool: sqlx issues a deferred BEGIN, so under WAL a concurrent writer
  fails rather than serialising."*
- A value that must stay in step with something in another file.

If you cannot state which of those a comment is, delete it.

Never write a comment that:

- Restates the code, the function name, or a type name in prose.
- Describes what a component renders or how a layout is arranged.
- Explains a design or styling choice nobody would question.
- Acts as a section header inside a function.
- Says what a test is testing when the test name already says it.

One or two lines. A block comment longer than three lines needs a reason to
exist. Do not comment every branch of a switch, every field of a struct or
interface, or every step of a sequence.

When editing existing code, leave surrounding comments alone unless they are
now wrong.

## Verifying

Run the app and check the change rather than assuming it works. Where a claim
cannot be verified — because the tooling cannot drive the interaction, or no key
is available — say so plainly rather than implying it was tested.

A test written from documentation proves the code agrees with the documentation,
not with reality. Where an external API is involved, shape fixtures from a real
response and keep a live contract test behind an env var.
