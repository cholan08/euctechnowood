import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { MIGRATIONS } from './migrations';

// One SQLite file holds the studio's records: staff, sessions, clients, projects,
// rooms, the image history, saved designs and the usage log. Image bytes live in
// the image store (server/storage), not in the database.
//
// node:sqlite ships with Node (no native add-on to build on the server). It is
// synchronous, which is right for one small server: each query takes microseconds.

export type Row = Record<string, SQLInputValue>;

export interface Db {
  /** All rows. */
  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[];
  /** The first row, or undefined. */
  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined;
  /** Runs a write; returns how many rows changed. */
  run(sql: string, ...params: SQLInputValue[]): number;
  /** Runs `work` in one transaction: all of it is saved, or none. */
  tx<T>(work: () => T): T;
  close(): void;
}

/** Opens (and creates or upgrades) the database. ":memory:" gives a throwaway one for tests. */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(sqlite);

  // Rows come back with a null prototype; spread them into plain objects for JSON and tests.
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : undefined);
  let depth = 0;

  const db: Db = {
    all: <T>(sql: string, ...params: SQLInputValue[]) => sqlite.prepare(sql).all(...params).map((r) => plain<T>(r)!),
    get: <T>(sql: string, ...params: SQLInputValue[]) => plain<T>(sqlite.prepare(sql).get(...params)),
    run: (sql, ...params) => Number(sqlite.prepare(sql).run(...params).changes),
    tx(work) {
      // Nested calls join the outer transaction.
      if (depth > 0) return work();
      depth++;
      sqlite.exec('BEGIN');
      try {
        const result = work();
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      } finally {
        depth--;
      }
    },
    close: () => sqlite.close(),
  };
  return db;
}

/** Applies the migrations this file has not seen yet, in order, each in its own transaction. */
function migrate(sqlite: DatabaseSync) {
  const { user_version: version } = sqlite.prepare('PRAGMA user_version').get() as { user_version: number };
  MIGRATIONS.slice(version).forEach((sql, i) => {
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(sql);
      sqlite.exec(`PRAGMA user_version = ${version + i + 1}`);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
  });
}

export const now = () => new Date().toISOString();
