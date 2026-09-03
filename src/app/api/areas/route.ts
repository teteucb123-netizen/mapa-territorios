import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toArea } from "@/lib/serializers";

export async function GET() {
  const rows = db.prepare(`SELECT * FROM areas ORDER BY created_at DESC`).all();
  return NextResponse.json(rows.map(toArea));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body.geojson) || body.geojson.length < 3) {
    return NextResponse.json(
      { error: "É necessário um polígono ('geojson') com pelo menos 3 pontos." },
      { status: 400 }
    );
  }

  const id = randomUUID();
  db.prepare(`INSERT INTO areas (id, name, geojson) VALUES (@id, @name, @geojson)`).run({
    id,
    name: body.name || "Área de atuação",
    geojson: JSON.stringify(body.geojson),
  });

  const row = db.prepare(`SELECT * FROM areas WHERE id = ?`).get(id);
  return NextResponse.json(toArea(row), { status: 201 });
}
