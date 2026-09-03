import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toArea } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM areas WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  const body = await req.json();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (body.name !== undefined) {
    fields.push("name = @name");
    values.name = body.name;
  }
  if (body.geojson !== undefined) {
    fields.push("geojson = @geojson");
    values.geojson = JSON.stringify(body.geojson);
  }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE areas SET ${fields.join(", ")} WHERE id = @id`).run(values);
  }

  const row = db.prepare(`SELECT * FROM areas WHERE id = ?`).get(id);
  return NextResponse.json(toArea(row));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM areas WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  db.prepare(`DELETE FROM areas WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
