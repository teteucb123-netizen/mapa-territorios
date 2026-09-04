import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { findPlaces, findStreets, roadDistanceMatrix, OverpassPlace } from "@/lib/routing";

const COLOR_PALETTE = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563", "#0d9488", "#ea580c"];

function nearest<T extends { lat: number; lng: number }>(point: { lat: number; lng: number }, candidates: T[]): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const c of candidates) {
    const km = haversineKm(point, c);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return best;
}

export async function POST() {
  const area = db.prepare(`SELECT * FROM areas ORDER BY created_at ASC LIMIT 1`).get() as
    | { id: string; geojson: string }
    | undefined;
  if (!area) {
    return NextResponse.json({ error: "Nenhuma área traçada encontrada." }, { status: 400 });
  }
  const ring: [number, number][] = JSON.parse(area.geojson);

  let places: OverpassPlace[];
  let streets: Awaited<ReturnType<typeof findStreets>>;
  try {
    [places, streets] = await Promise.all([findPlaces(ring), findStreets(ring)]);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Não foi possível consultar o OpenStreetMap agora (serviço Overpass indisponível ou muito lento). Tente novamente em alguns instantes.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }

  // Bairros (nível 1) = place=suburb. Se a área não tiver nenhum "suburb"
  // mapeado (comum em bases do OSM menos detalhadas), promove tudo que foi
  // encontrado a bairro em vez de terminar sem nenhum.
  let bairroCandidates = places.filter((p) => p.placeType === "suburb");
  let subCandidates = places.filter((p) => p.placeType !== "suburb");
  if (bairroCandidates.length === 0) {
    bairroCandidates = places;
    subCandidates = [];
  }

  db.exec(`DELETE FROM units; DELETE FROM regions;`);

  const insertRegion = db.prepare(
    `INSERT INTO regions (id, name, color, centroid_lat, centroid_lng, parent_id, source)
     VALUES (@id, @name, @color, @lat, @lng, @parent_id, 'overpass')`
  );
  const insertUnit = db.prepare(
    `INSERT INTO units (id, name, lat, lng, region_id, type, source)
     VALUES (@id, @name, @lat, @lng, @region_id, 'Rua', 'overpass')`
  );

  type Placed = { id: string; name: string; lat: number; lng: number };
  const bairros: Placed[] = bairroCandidates.map((p, i) => {
    const id = randomUUID();
    insertRegion.run({ id, name: p.name, color: COLOR_PALETTE[i % COLOR_PALETTE.length], lat: p.lat, lng: p.lng, parent_id: null });
    return { id, name: p.name, lat: p.lat, lng: p.lng };
  });

  const subBairros: Placed[] = subCandidates.map((p) => {
    const parent = bairros.length > 0 ? nearest(p, bairros) : null;
    const id = randomUUID();
    const color = parent ? COLOR_PALETTE[bairros.indexOf(parent) % COLOR_PALETTE.length] : "#64748b";
    insertRegion.run({ id, name: p.name, color, lat: p.lat, lng: p.lng, parent_id: parent?.id ?? null });
    return { id, name: p.name, lat: p.lat, lng: p.lng };
  });

  const navigablePlaces = [...bairros, ...subBairros];
  let streetsInserted = 0;
  for (const s of streets) {
    const parent = navigablePlaces.length > 0 ? nearest(s, navigablePlaces) : null;
    insertUnit.run({ id: randomUUID(), name: s.name, lat: s.lat, lng: s.lng, region_id: parent?.id ?? null });
    streetsInserted++;
  }

  // Pré-calcula e ARMAZENA as distâncias entre bairros (nível 1) — a aba
  // Distâncias só lê essa tabela depois, nunca recalcula na hora.
  let distancesComputed = 0;
  let distancesEstimated = false;
  db.prepare(`DELETE FROM bairro_distances`).run();
  if (bairros.length >= 2) {
    const matrix = await roadDistanceMatrix(bairros.map((b) => ({ lat: b.lat, lng: b.lng })));
    distancesEstimated = matrix.estimated;
    const insertDist = db.prepare(
      `INSERT INTO bairro_distances (origin_id, dest_id, km, minutes, estimated) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < bairros.length; i++) {
      for (let j = 0; j < bairros.length; j++) {
        if (i === j) continue;
        insertDist.run(bairros[i].id, bairros[j].id, matrix.km[i][j], matrix.minutes[i][j], matrix.estimated ? 1 : 0);
        distancesComputed++;
      }
    }
  }

  return NextResponse.json({
    bairros: bairros.length,
    subBairros: subBairros.length,
    ruas: streetsInserted,
    distancesComputed,
    distancesEstimated,
  });
}
