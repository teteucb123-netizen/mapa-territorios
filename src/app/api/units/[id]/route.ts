import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toUnit } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

const EDITABLE_FIELDS = [
  "name",
  "code",
  "address",
  "cep",
  "neighborhood",
  "city",
  "state",
  "lat",
  "lng",
  "region_id",
  "responsible",
  "team_id",
  "type",
  "phone",
  "notes",
];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id);
  if (!row) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });
  return NextResponse.json(toUnit(row));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });

  const body = await req.json();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = body[key];
    }
  }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE units SET ${fields.join(", ")} WHERE id = @id`).run(values);
  }

  const row = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id);
  return NextResponse.json(toUnit(row));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });

  db.prepare(`DELETE FROM units WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
