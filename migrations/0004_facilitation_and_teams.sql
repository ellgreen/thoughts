CREATE TABLE teams (
    id         TEXT PRIMARY KEY,
    slug       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

ALTER TABLE retros ADD COLUMN team_id TEXT REFERENCES teams (id) ON DELETE SET NULL;
CREATE INDEX retros_team ON retros (team_id, created_at);

-- The timer runs until timer_ends_at, or is paused with timer_left seconds
-- to go. Both empty means no timer.
ALTER TABLE retros ADD COLUMN timer_ends_at TEXT;
ALTER TABLE retros ADD COLUMN timer_left INTEGER;

-- The group everyone is looking at while discussing.
ALTER TABLE retros ADD COLUMN spotlight_group_id TEXT REFERENCES groups (id) ON DELETE SET NULL;

-- Who has said they're done with a stage. Kept per stage, so moving back
-- shows who was done before.
CREATE TABLE ready (
    retro_id TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users (id),
    stage    TEXT NOT NULL,
    PRIMARY KEY (retro_id, user_id, stage)
);

-- An action is open until it's done, or closed without being done: carried
-- into a later retro (which gets a copy pointing back at it) or dropped.
ALTER TABLE actions ADD COLUMN closed TEXT CHECK (closed IN ('carried', 'dropped'));
ALTER TABLE actions ADD COLUMN carried_from TEXT REFERENCES actions (id) ON DELETE SET NULL;
