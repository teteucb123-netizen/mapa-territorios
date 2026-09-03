import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toRegion } from "@/lib/serializers";
import { polygonCentroid } from "@/lib/geo";

export async function GET() {
  const rows = db.prepare(`SELECT * FROM regions ORDER BY name COLLATE NOCASE`).all();
  return NextResponse.json(rows.map(toRegion));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "O campo 'name' é obrigatório." }, { status: 400 });
  }

  const parent_id: string | null = body.parent_id ?? null;
  if (parent_id) {
    const parent = db.prepare(`SELECT id, parent_id FROM regions WHERE id = ?`).get(parent_id) as
      | { id: string; parent_id: string | null }
      | undefined;
    if (!parent) return NextResponse.json({ error: "Região pai (bairro) não encontrada." }, { status: 400 });
    if (parent.parent_id) {
      return NextResponse.json(
        { error: "Só é permitido um nível de sub-bairro: escolha um bairro (sem pai) como região pai." },
        { status: 400 }
      );
    }
  }

  const id = randomUUID();
  const geojson: [number, number][] | null = Array.isArray(body.geojson) ? body.geojson : null;
  let centroid: { lat: number; lng: number } | null = null;
  if (geojson && geojson.length >= 1) {
    try {
      centroid = polygonCentroid(geojson);
    } catch {
      centroid = null;
    }
  }

  db.prepare(
    `INSERT INTO regions (id, name, code, color, geojson, responsible, team_id, notes, centroid_lat, centroid_lng, parent_id)
     VALUES (@id, @name, @code, @color, @geojson, @responsible, @team_id, @notes, @centroid_lat, @centroid_lng, @parent_id)`
  ).run({
    id,
    name: body.name,
    code: body.code ?? null,
    color: body.color ?? "#2563eb",
    geojson: geojson ? JSON.stringify(geojson) : null,
    responsible: body.responsible ?? null,
    team_id: body.team_id ?? null,
    notes: body.notes ?? null,
    centroid_lat: centroid?.lat ?? null,
    centroid_lng: centroid?.lng ?? null,
    parent_id,
  });

  const row = db.prepare(`SELECT * FROM regions WHERE id = ?`).get(id);
  return NextResponse.json(toRegion(row), { status: 201 });
}
