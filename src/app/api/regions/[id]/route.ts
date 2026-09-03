import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toRegion } from "@/lib/serializers";
import { polygonCentroid } from "@/lib/geo";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = db.prepare(`SELECT * FROM regions WHERE id = ?`).get(id);
  if (!row) return NextResponse.json({ error: "Região não encontrada." }, { status: 404 });
  return NextResponse.json(toRegion(row));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM regions WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Região não encontrada." }, { status: 404 });

  const body = await req.json();
  const geojson: [number, number][] | null | undefined = body.geojson;
  let centroidUpdate: { lat: number | null; lng: number | null } | null = null;
  if (geojson !== undefined) {
    if (Array.isArray(geojson) && geojson.length >= 1) {
      try {
        const c = polygonCentroid(geojson);
        centroidUpdate = { lat: c.lat, lng: c.lng };
      } catch {
        centroidUpdate = { lat: null, lng: null };
      }
    } else {
      centroidUpdate = { lat: null, lng: null };
    }
  }

  const fields: string[] = [];
  const values: Record<string, unknown> = { id };
  const assign = (col: string, val: unknown) => {
    fields.push(`${col} = @${col}`);
    values[col] = val;
  };

  if (body.name !== undefined) assign("name", body.name);
  if (body.code !== undefined) assign("code", body.code);
  if (body.color !== undefined) assign("color", body.color);
  if (geojson !== undefined) assign("geojson", geojson ? JSON.stringify(geojson) : null);
  if (body.responsible !== undefined) assign("responsible", body.responsible);
  if (body.team_id !== undefined) assign("team_id", body.team_id);
  if (body.notes !== undefined) assign("notes", body.notes);
  if (centroidUpdate) {
    assign("centroid_lat", centroidUpdate.lat);
    assign("centroid_lng", centroidUpdate.lng);
  }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE regions SET ${fields.join(", ")} WHERE id = @id`).run(values);
  }

  const row = db.prepare(`SELECT * FROM regions WHERE id = ?`).get(id);
  return NextResponse.json(toRegion(row));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM regions WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Região não encontrada." }, { status: 404 });

  db.prepare(`UPDATE units SET region_id = NULL WHERE region_id = ?`).run(id);
  db.prepare(`DELETE FROM regions WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
