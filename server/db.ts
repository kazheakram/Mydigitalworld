import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type DB = DatabaseSync;

export function openDb(dataDir: string): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'world.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS config_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, json TEXT NOT NULL,
      label TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, room_id TEXT, visibility TEXT NOT NULL DEFAULT 'private',
      data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS items_kind ON items(kind, room_id);
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, site_url TEXT,
      category TEXT NOT NULL DEFAULT 'Internet Discoveries', last_fetched TEXT, last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS feed_entries (
      id TEXT PRIMARY KEY, feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, published TEXT, summary TEXT NOT NULL,
      image TEXT, read INTEGER NOT NULL DEFAULT 0, saved INTEGER NOT NULL DEFAULT 0,
      UNIQUE(feed_id, guid)
    );
  `);
  return db;
}
