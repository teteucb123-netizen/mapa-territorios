import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTeam } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(id);
  if (!row) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });
  return NextResponse.json(toTeam(row));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });

  const body = await req.json();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };
  const assign = (col: string, val: unknown) => {
    fields.push(`${col} = @${col}`);
    values[col] = val;
  };

  if (body.name !== undefined) assign("name", body.name);
  if (body.responsible !== undefined) assign("responsible", body.responsible);
  if (body.members !== undefined) assign("members", JSON.stringify(body.members ?? []));
  if (body.vehicle !== undefined) assign("vehicle", body.vehicle);
  if (body.notes !== undefined) assign("notes", body.notes);

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE teams SET ${fields.join(", ")} WHERE id = @id`).run(values);
  }

  const row = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(id);
  return NextResponse.json(toTeam(row));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Equipe não encontrada." }, { status: 404 });

  db.prepare(`UPDATE regions SET team_id = NULL WHERE team_id = ?`).run(id);
  db.prepare(`UPDATE units SET team_id = NULL WHERE team_id = ?`).run(id);
  db.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
