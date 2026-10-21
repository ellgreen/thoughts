# Decisions

Short, dated, append-only. What, why, and what it rules out.

## 2026-10-21: rebuild v2 from scratch on a `v2` branch

v2 is a new codebase in the same repository, released as 2.0.0 to the same
image (`ghcr.io/ellgreen/thoughts`), so upgrading is a tag bump. v1 keeps
getting fixes on `1.x`. Rules out a separate repository and image name.

## 2026-10-21: a clean schema and a one-shot v1 import

v2 has its own schema (a real groups table, RFC 3339 times, foreign keys on).
On first start against a v1 database it backs the file up, then converts it in
one transaction. Until the importer lands, v2 refuses to open a v1 database
rather than half-migrating it. Retro ids are kept, so v1 links keep working.
Rules out carrying v1's tables forward.

## 2026-10-21: standard library first

Routing is `net/http`'s mux, config is plain environment parsing, migrations
are a small runner over embedded files. v1's viper, gorilla/mux,
gorilla/sessions and goose are gone. Each new dependency needs a line here.

- `modernc.org/sqlite`: pure Go SQLite, so the binary and image need no cgo.

## 2026-10-21: everyone is equal in a retro

No host or facilitator role, as in v1. Anyone can move the stage, start a
timer or apply an AI suggestion.

## 2026-10-21: TypeScript 7 for type-checking, oxlint for linting

TypeScript 7 (the native compiler) checks types. typescript-eslint still needs
the TypeScript 6 JavaScript API, so linting is oxlint, which does not depend
on the `typescript` package and covers the hooks and a11y rules we used.
Revisit when typescript-eslint supports 7.

## 2026-10-21: pnpm 11

pnpm 12 ships as a native binary that corepack can't launch yet, so the repo
pins pnpm 11.24. The lockfile format is the same. Docker installs it with npm
because Node 26 no longer bundles corepack.

## 2026-10-21: the image runs as root

v1's image ran as root, so existing `/data` volumes are owned by root. A
non-root v2 could not open them after an upgrade. Run with `--user` to opt
out. The image is distroless and about 14 MB.

## 2026-10-21: the server sends each person the whole board

After every change the server loads the retro once and sends everyone their
own projection of it: hidden notes stay hidden on the server, vote totals stay
private until discussion. A board is tens of notes, so this is small, and it
makes reconnecting trivially right: a new connection gets the current board.
Each board carries a version so a stale frame is never applied over a newer
one. This replaces the planned per-change events with sequence numbers and
replay, which would have needed per-event visibility rules on the client too.

- `github.com/coder/websocket`: a small, maintained WebSocket library with
  context support; the standard library has none.

## 2026-10-21: moving notes from the keyboard is a picker, not a drag

React Aria's keyboard drag starts on Enter, which collided with the board's
own shortcuts and once dropped a note into the wrong group in testing. Mouse
and touch drag notes, onto another note to group them or onto a column's
"pile of its own" to take them out. From the keyboard, a note's menu has
"Move to…", a searchable list of groups and columns. A dedicated key for it
was dropped with the other per-note keys: few people found them.

## 2026-10-21: v1 sessions carry over

v1 signed its session cookie with `session.key` using gorilla/sessions'
cookie store. On a request with no v2 session, v2 checks for a v1 cookie,
and if it is valid and its user exists, issues a v2 session for that user
and clears the old cookie. Without this, every upgrade would sign everyone
out, and with name sign-in, signing back in makes a new person, so nobody's
notes would be "theirs" any more.

- `github.com/gorilla/securecookie`: reads v1's cookie format exactly.
  Only `internal/v1import` uses it.

## 2026-10-21: LDAP binds as the person; OIDC is code flow with PKCE

LDAP has no service account: thoughts binds with the credentials typed in,
then reads the person's own entry. Nothing secret is stored, and the
directory's own rules decide who can sign in. The catch is that some
directories hide `memberOf` from users, so group checks also ask the group.
OIDC discovers the provider lazily, so a provider outage doesn't stop
thoughts starting. Failed redirect sign-ins come back as a short code that
the sign-in page turns into words, so the URL can't carry made-up text.

- `github.com/go-ldap/ldap/v3`: the maintained Go LDAP client.
- `github.com/coreos/go-oidc/v3` and `golang.org/x/oauth2`: ID token
  verification and the code exchange; too easy to get subtly wrong by hand.

## 2026-10-21: AI through four drivers, always as suggestions

One small interface (a prompt and a JSON schema in, JSON out) with drivers
for Anthropic, OpenAI, any OpenAI-compatible server, and the GitHub Copilot
SDK. Features are prompts plus validators that drop anything the model made
up. The model sees note text, never authors, and nothing while notes are
hidden. Suggestions are shown to the room and change nothing until someone
applies them, because grouping someone else's notes behind their back would
feel wrong. The Copilot CLI is not bundled into the image (about 170 MB
against a 14 MB image); it runs as a sidecar.

- `github.com/anthropics/anthropic-sdk-go`, `github.com/openai/openai-go/v3`,
  `github.com/github/copilot-sdk/go`: the official SDKs. langchaingo (v1's
  choice) is dropped; a thin interface over the official SDKs is less code.

## 2026-10-21: actions are done, carried or dropped

"Last time first" shows a team's open actions from earlier retros. Carrying
one over copies it into the new retro, linked back with `carried_from`, and
closes the original as carried; dropping closes it as dropped. Open means
neither done nor closed, so an action never shows up twice and its history
stays where it was written. Timers are stored as an end time (or seconds
left while paused) and counted down against the server's clock, so a
reconnect or a skewed laptop clock still shows everyone the same time.

## 2026-10-21: React Aria Components instead of shadcn and Radix

Unstyled, accessible primitives with keyboard drag and drop built in, styled
from scratch for the zine design. Rules out shadcn's look and lucide icons.
