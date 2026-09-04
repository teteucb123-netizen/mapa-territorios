import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

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
  geojson TEXT NOT NULL,        -- GeoJSON Polygon coordinates as JSON, ring of [lng, lat]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT NOT NULL DEFAULT '#2563eb',
  geojson TEXT,                 -- GeoJSON Polygon coordinates as JSON (bairros/sub-bairros vindos do Overpass geralmente não têm polígono, só ponto central)
  responsible TEXT,
  notes TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL,  -- NULL = Bairro (nível 1); preenchido = Sub-bairro (nível 2)
  place_type TEXT,              -- classificação original do OSM (suburb, neighbourhood, quarter, hamlet, locality) — preservada, não inventada
  source TEXT NOT NULL DEFAULT 'manual',  -- 'overpass' (identificado automaticamente) | 'manual'
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
  type TEXT,
  phone TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'overpass' (rua identificada automaticamente) | 'manual'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Distâncias entre bairros (nível 1) já calculadas e armazenadas — a aba
-- Distâncias só LÊ esta tabela, nunca recalcula na hora.
CREATE TABLE IF NOT EXISTS bairro_distances (
  origin_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  dest_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  km REAL NOT NULL,
  minutes REAL,
  estimated INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (origin_id, dest_id)
);

CREATE INDEX IF NOT EXISTS idx_units_region ON units(region_id);
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id);
`);

// --- Lightweight migrations for databases created by earlier versions of
// this app (adding columns in place instead of losing existing data). ---
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("regions", "parent_id", `parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL`);
ensureColumn("regions", "source", `source TEXT NOT NULL DEFAULT 'manual'`);
ensureColumn("regions", "place_type", `place_type TEXT`);
ensureColumn("units", "source", `source TEXT NOT NULL DEFAULT 'manual'`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id)`);

// --- Seed the pre-traced operating area on first run, reconstructed from
// the reference map the client provided (Zona Oeste do Rio: Campo Grande,
// Paciência, Cosmos, Inhoaíba, Senador Vasconcelos, Santíssimo, Guaratiba
// and nearby localities). This is an approximate redraw from a flat
// screenshot, not a georeferenced source — adjust with "Redesenhar área" on
// the map if it doesn't quite match. ---
const SEED_AREA_NAME = "Área de atuação (Zona Oeste — Campo Grande/Guaratiba/Paciência)";
const SEED_AREA: [number, number][] = [
  [-43.665, -22.865],
  [-43.6, -22.855],
  [-43.555, -22.86],
  [-43.545, -22.9],
  [-43.555, -22.95],
  [-43.575, -22.99],
  [-43.605, -23.015],
  [-43.665, -23.01],
  [-43.675, -22.95],
];

const existingSeedArea = db
  .prepare(`SELECT id FROM areas WHERE name LIKE 'Área de atuação (Zona Oeste%'`)
  .get() as { id: string } | undefined;

if (existingSeedArea) {
  // Keep our own reconstructed default in sync as it gets refined across
  // versions (e.g. widened to make sure Campo Grande itself falls inside
  // the traced boundary). A manually redrawn area keeps the same row/name
  // today, so this intentionally stays a best-effort default, not a lock —
  // use "Redesenhar área" any time to override it for good.
  db.prepare(`UPDATE areas SET name = ?, geojson = ? WHERE id = ?`).run(
    SEED_AREA_NAME,
    JSON.stringify(SEED_AREA),
    existingSeedArea.id
  );
} else {
  const areaCount = (db.prepare(`SELECT COUNT(*) AS c FROM areas`).get() as { c: number }).c;
  if (areaCount === 0) {
    db.prepare(`INSERT INTO areas (id, name, geojson) VALUES (?, ?, ?)`).run(randomUUID(), SEED_AREA_NAME, JSON.stringify(SEED_AREA));
  }
}
