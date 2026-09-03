import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// SQLite database file. In production on a host with a persistent disk
// (Railway, Render, VPS) this file survives restarts. On serverless hosts
// with an ephemeral filesystem (e.g. Vercel functions) this file resets on
// every cold start — see README.md "Publicação online" before deploying
// there. Point DB_PATH at a mounted volume in that case.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Reuse a single connection across hot-reloads in dev (Next.js reloads
// modules on every request in dev mode otherwise, which would exhaust
// SQLite file handles).
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export const db: Database.Database = globalForDb.__db ?? new Database(DB_PATH);
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  geojson TEXT NOT NULL,        -- GeoJSON Polygon coordinates as JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  responsible TEXT,
  members TEXT,                 -- JSON array of strings
  vehicle TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT NOT NULL DEFAULT '#2563eb',
  geojson TEXT,                 -- GeoJSON Polygon coordinates as JSON (nullable until drawn)
  responsible TEXT,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  notes TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL,  -- NULL = Bairro (top level); set = Sub-bairro (child of a Bairro)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  cep TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  responsible TEXT,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  type TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin_unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  stop_unit_ids TEXT NOT NULL,   -- JSON array of unit ids, in sequence
  total_km REAL,
  total_min REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_units_region ON units(region_id);
CREATE INDEX IF NOT EXISTS idx_units_team ON units(team_id);
CREATE INDEX IF NOT EXISTS idx_regions_team ON regions(team_id);
`);

// Lightweight migration: older databases created before "parent_id" existed
// (Bairro/Sub-bairro hierarchy) won't have the column yet. Add it in place
// instead of losing data.
const regionColumns = db.prepare(`PRAGMA table_info(regions)`).all() as { name: string }[];
if (!regionColumns.some((c) => c.name === "parent_id")) {
  db.exec(`ALTER TABLE regions ADD COLUMN parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id)`);
}

export function touch(table: string, id: string) {
  db.prepare(`UPDATE ${table} SET updated_at = datetime('now') WHERE id = ?`).run(id);
}
