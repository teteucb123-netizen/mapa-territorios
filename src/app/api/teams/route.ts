import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toTeam } from "@/lib/serializers";

export async function GET() {
  const rows = db.prepare(`SELECT * FROM teams ORDER BY name COLLATE NOCASE`).all();
  return NextResponse.json(rows.map(toTeam));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "O campo 'name' é obrigatório." }, { status: 400 });
  }

  const id = randomUUID();
  const members: string[] = Array.isArray(body.members) ? body.members : [];

  db.prepare(
    `INSERT INTO teams (id, name, responsible, members, vehicle, notes)
     VALUES (@id, @name, @responsible, @members, @vehicle, @notes)`
  ).run({
    id,
    name: body.name,
    responsible: body.responsible ?? null,
    members: JSON.stringify(members),
    vehicle: body.vehicle ?? null,
    notes: body.notes ?? null,
  });

  const row = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(id);
  return NextResponse.json(toTeam(row), { status: 201 });
}
