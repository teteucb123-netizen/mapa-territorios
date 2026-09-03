import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toRoute } from "@/lib/serializers";
import { optimizedTrip } from "@/lib/routing";

export async function GET() {
  const rows = db.prepare(`SELECT * FROM routes ORDER BY created_at DESC`).all();
  return NextResponse.json(rows.map(toRoute));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { origin_unit_id, stop_unit_ids, name } = body;

  if (!origin_unit_id || !Array.isArray(stop_unit_ids) || stop_unit_ids.length === 0) {
    return NextResponse.json(
      { error: "Informe 'origin_unit_id' e ao menos uma parada em 'stop_unit_ids'." },
      { status: 400 }
    );
  }

  const origin = db.prepare(`SELECT id, name, lat, lng FROM units WHERE id = ?`).get(origin_unit_id) as
    | { id: string; name: string; lat: number; lng: number }
    | undefined;
  if (!origin) return NextResponse.json({ error: "Unidade de origem não encontrada." }, { status: 404 });

  const placeholders = stop_unit_ids.map(() => "?").join(",");
  const stopRows = db
    .prepare(`SELECT id, name, lat, lng FROM units WHERE id IN (${placeholders})`)
    .all(...stop_unit_ids) as { id: string; name: string; lat: number; lng: number }[];

  if (stopRows.length !== stop_unit_ids.length) {
    return NextResponse.json({ error: "Uma ou mais unidades de destino não foram encontradas." }, { status: 404 });
  }
  // Preserve caller's stop order for lookups, but feed coordinates through optimizer.
  const orderedStops = stop_unit_ids.map((id: string) => stopRows.find((s) => s.id === id)!);

  const trip = await optimizedTrip(
    { lat: origin.lat, lng: origin.lng },
    orderedStops.map((s) => ({ lat: s.lat, lng: s.lng }))
  );

  const sequence = trip.order.map((idx) => orderedStops[idx]);

  const id = randomUUID();
  db.prepare(
    `INSERT INTO routes (id, name, origin_unit_id, stop_unit_ids, total_km, total_min)
     VALUES (@id, @name, @origin_unit_id, @stop_unit_ids, @total_km, @total_min)`
  ).run({
    id,
    name: name || `Rota a partir de ${origin.name}`,
    origin_unit_id,
    stop_unit_ids: JSON.stringify(sequence.map((s) => s.id)),
    total_km: Number(trip.km.toFixed(1)),
    total_min: Number(trip.minutes.toFixed(0)),
  });

  const row = db.prepare(`SELECT * FROM routes WHERE id = ?`).get(id);
  return NextResponse.json(
    {
      ...toRoute(row),
      sequence: [
        { id: origin.id, name: origin.name, lat: origin.lat, lng: origin.lng },
        ...sequence,
      ],
      estimated: trip.estimated,
    },
    { status: 201 }
  );
}
