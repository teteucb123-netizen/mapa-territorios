import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toUnit } from "@/lib/serializers";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region_id = sp.get("region_id");
  const team_id = sp.get("team_id");
  const city = sp.get("city");
  const neighborhood = sp.get("neighborhood");
  const type = sp.get("type");

  const clauses: string[] = [];
  const values: Record<string, string> = {};
  if (region_id) {
    clauses.push("region_id = @region_id");
    values.region_id = region_id;
  }
  if (team_id) {
    clauses.push("team_id = @team_id");
    values.team_id = team_id;
  }
  if (city) {
    clauses.push("city LIKE @city");
    values.city = `%${city}%`;
  }
  if (neighborhood) {
    clauses.push("neighborhood LIKE @neighborhood");
    values.neighborhood = `%${neighborhood}%`;
  }
  if (type) {
    clauses.push("type = @type");
    values.type = type;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM units ${where} ORDER BY name COLLATE NOCASE`).all(values);
  return NextResponse.json(rows.map(toUnit));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "O campo 'name' é obrigatório." }, { status: 400 });
  }
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json(
      { error: "Coordenadas 'lat' e 'lng' são obrigatórias (informe manualmente ou geocodifique o endereço)." },
      { status: 400 }
    );
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO units (id, name, code, address, cep, neighborhood, city, state, lat, lng, region_id, responsible, team_id, type, phone, notes)
     VALUES (@id, @name, @code, @address, @cep, @neighborhood, @city, @state, @lat, @lng, @region_id, @responsible, @team_id, @type, @phone, @notes)`
  ).run({
    id,
    name: body.name,
    code: body.code ?? null,
    address: body.address ?? null,
    cep: body.cep ?? null,
    neighborhood: body.neighborhood ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    lat: body.lat,
    lng: body.lng,
    region_id: body.region_id ?? null,
    responsible: body.responsible ?? null,
    team_id: body.team_id ?? null,
    type: body.type ?? null,
    phone: body.phone ?? null,
    notes: body.notes ?? null,
  });

  const row = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id);
  return NextResponse.json(toUnit(row), { status: 201 });
}
