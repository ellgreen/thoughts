CREATE TABLE retros (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    stage      TEXT NOT NULL CHECK (stage IN ('reflect', 'group', 'vote', 'discuss')),
    max_votes  INTEGER NOT NULL DEFAULT 5,
    unlisted   INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX retros_listed ON retros (unlisted, created_at);

CREATE TABLE retro_tags (
    retro_id TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    tag      TEXT NOT NULL,
    PRIMARY KEY (retro_id, tag)
);
CREATE INDEX retro_tags_tag ON retro_tags (tag);

CREATE TABLE columns (
    id          TEXT PRIMARY KEY,
    retro_id    TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX columns_retro ON columns (retro_id, position);

-- Every note is in a group; an ungrouped note is a group of one. Votes are
-- on groups, so they survive notes being added to or taken out of one.
CREATE TABLE groups (
    id         TEXT PRIMARY KEY,
    retro_id   TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    column_id  TEXT NOT NULL REFERENCES columns (id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX groups_retro ON groups (retro_id);

CREATE TABLE notes (
    id         TEXT PRIMARY KEY,
    retro_id   TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    group_id   TEXT NOT NULL REFERENCES groups (id),
    author_id  TEXT NOT NULL REFERENCES users (id),
    content    TEXT NOT NULL,
    img_url    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX notes_retro ON notes (retro_id, created_at);
CREATE INDEX notes_group ON notes (group_id);

CREATE TABLE votes (
    retro_id TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users (id),
    group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    count    INTEGER NOT NULL CHECK (count > 0),
    PRIMARY KEY (user_id, group_id)
);
CREATE INDEX votes_retro ON votes (retro_id);

CREATE TABLE reactions (
    note_id    TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users (id),
    emoji      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (note_id, user_id, emoji)
);

CREATE TABLE actions (
    id         TEXT PRIMARY KEY,
    retro_id   TEXT NOT NULL REFERENCES retros (id) ON DELETE CASCADE,
    what       TEXT NOT NULL,
    who        TEXT NOT NULL DEFAULT '',
    due_on     TEXT,
    done_at    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX actions_retro ON actions (retro_id);
CREATE INDEX actions_open ON actions (done_at);
