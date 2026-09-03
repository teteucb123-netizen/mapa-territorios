import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roadDistanceMatrix } from "@/lib/routing";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "units"; // "units" | "regions"

  if (type === "regions") {
    const regions = db
      .prepare(`SELECT id, name, color, centroid_lat, centroid_lng FROM regions WHERE centroid_lat IS NOT NULL`)
      .all() as { id: string; name: string; color: string; centroid_lat: number; centroid_lng: number }[];

    if (regions.length === 0) {
      return NextResponse.json({ labels: [], ids: [], km: [], minutes: [], estimated: false });
    }

    const points = regions.map((r) => ({ lat: r.centroid_lat, lng: r.centroid_lng }));
    const matrix = await roadDistanceMatrix(points);

    return NextResponse.json({
      labels: regions.map((r) => r.name),
      ids: regions.map((r) => r.id),
      colors: regions.map((r) => r.color),
      km: matrix.km.map((row) => row.map((v) => Number(v.toFixed(1)))),
      minutes: matrix.minutes.map((row) => row.map((v) => Number(v.toFixed(0)))),
      estimated: matrix.estimated,
    });
  }

  // type === "units"
  const region_id = req.nextUrl.searchParams.get("region_id");
  const where = region_id ? "WHERE region_id = ?" : "";
  const args = region_id ? [region_id] : [];
  const units = db
    .prepare(`SELECT id, name, lat, lng FROM units ${where} ORDER BY name COLLATE NOCASE`)
    .all(...args) as { id: string; name: string; lat: number; lng: number }[];

  if (units.length === 0) {
    return NextResponse.json({ labels: [], ids: [], km: [], minutes: [], estimated: false });
  }
  if (units.length > 40) {
    return NextResponse.json(
      { error: "Muitas unidades para calcular de uma vez (limite: 40). Use os filtros para reduzir." },
      { status: 400 }
    );
  }

  const points = units.map((u) => ({ lat: u.lat, lng: u.lng }));
  const matrix = await roadDistanceMatrix(points);

  return NextResponse.json({
    labels: units.map((u) => u.name),
    ids: units.map((u) => u.id),
    km: matrix.km.map((row) => row.map((v) => Number(v.toFixed(1)))),
    minutes: matrix.minutes.map((row) => row.map((v) => Number(v.toFixed(0)))),
    estimated: matrix.estimated,
  });
}
