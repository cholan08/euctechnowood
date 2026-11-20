import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';

// SQLite in one file: no database server to install or pay for, and plenty for
// a pilot. When traffic grows, move these two tables to Postgres; only the
// repositories (server/db/*.ts) touch SQL.
mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'euc.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS designs (
    id          TEXT PRIMARY KEY,
    room_type   TEXT NOT NULL,
    label       TEXT NOT NULL,
    summary     TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    provider    TEXT NOT NULL,
    before_file TEXT NOT NULL,
    after_file  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    design_id  TEXT REFERENCES designs(id),
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    city       TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at DESC);
`);
