// The database schema, one entry per version. Never edit an entry that has
// shipped: add a new one. PRAGMA user_version records how many have run.
//
// Times are ISO-8601 UTC strings. Ids are random UUIDs.

export const MIGRATIONS: string[] = [
  /* 1: staff, sessions, clients, projects, rooms, image history, saved designs, usage */ `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'designer', 'viewer')),
    daily_limit   INTEGER,              -- images per day; NULL = the studio default
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    id_hash    TEXT PRIMARY KEY,        -- sha256 of the cookie value; the value itself is never stored
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL            -- moves forward on every request (idle timeout)
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE clients (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    address    TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE projects (
    id         TEXT PRIMARY KEY,
    client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'presented', 'approved', 'archived')),
    notes      TEXT NOT NULL DEFAULT '',
    owner_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX projects_client ON projects(client_id);

  -- Who else works on a project. The owner and admins can always edit.
  CREATE TABLE project_members (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access     TEXT NOT NULL CHECK (access IN ('edit', 'view')),
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE rooms (
    id                TEXT PRIMARY KEY,
    project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    room_type         TEXT NOT NULL,
    original_image_id TEXT,             -- set right after the first image is stored
    cover_image_id    TEXT,             -- the latest saved design, for thumbnails
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE INDEX rooms_project ON rooms(project_id);

  -- Every image of a room, oldest first: the original, each change, concepts, final images, boards.
  CREATE TABLE images (
    id         TEXT PRIMARY KEY,
    room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    parent_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('original', 'edit', 'design', 'concept', 'final', 'board')),
    label      TEXT NOT NULL DEFAULT '',
    detail     TEXT NOT NULL DEFAULT '',
    mime       TEXT NOT NULL,
    bytes      INTEGER NOT NULL,
    width      INTEGER NOT NULL,
    height     INTEGER NOT NULL,
    meta       TEXT NOT NULL DEFAULT '{}', -- JSON: prompt, style, specs...
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX images_room ON images(room_id, created_at);

  -- Designs staff chose to keep, with a name, to show the client.
  CREATE TABLE designs (
    id         TEXT PRIMARY KEY,
    room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    image_id   TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    notes      TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX designs_room ON designs(room_id);

  -- One row per AI call, kept when the project is deleted, so cost stays accountable.
  CREATE TABLE usage_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    action     TEXT NOT NULL,           -- edit | remove | redesign | generate | final | assist | recommend
    images     INTEGER NOT NULL,        -- images asked for (0 for text)
    provider   TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
    ms         INTEGER NOT NULL,
    error      TEXT
  );
  CREATE INDEX usage_user_day ON usage_log(user_id, created_at);
  `,
];
