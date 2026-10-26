-- A suggestion is shown to everyone in the retro until someone applies or
-- dismisses it. There is at most one of each kind at a time.
CREATE TABLE ai_suggestions (
    id         TEXT PRIMARY KEY,
    retro_id   TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('groups', 'names', 'actions')),
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (retro_id, kind)
);

ALTER TABLE retros ADD COLUMN recap TEXT NOT NULL DEFAULT '';
