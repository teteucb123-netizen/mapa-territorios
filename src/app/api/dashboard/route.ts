import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

export async function GET() {
  const totalRegions = (db.prepare(`SELECT COUNT(*) AS c FROM regions`).get() as { c: number }).c;
  const totalUnits = (db.prepare(`SELECT COUNT(*) AS c FROM units`).get() as { c: number }).c;
  const totalTeams = (db.prepare(`SELECT COUNT(*) AS c FROM teams`).get() as { c: number }).c;

  const regionCounts = db
    .prepare(
      `SELECT r.id, r.name, r.color, COUNT(u.id) AS unit_count
       FROM regions r LEFT JOIN units u ON u.region_id = r.id
       GROUP BY r.id ORDER BY unit_count DESC`
    )
    .all() as { id: string; name: string; color: string; unit_count: number }[];

  const topRegion = regionCounts[0] ?? null;

  const regionCentroids = db
    .prepare(`SELECT id, name, centroid_lat, centroid_lng FROM regions WHERE centroid_lat IS NOT NULL`)
    .all() as { id: string; name: string; centroid_lat: number; centroid_lng: number }[];

  let nearestPair: { a: string; b: string; km: number } | null = null;
  let farthestPair: { a: string; b: string; km: number } | null = null;
  for (let i = 0; i < regionCentroids.length; i++) {
    for (let j = i + 1; j < regionCentroids.length; j++) {
      const km = haversineKm(
        { lat: regionCentroids[i].centroid_lat, lng: regionCentroids[i].centroid_lng },
        { lat: regionCentroids[j].centroid_lat, lng: regionCentroids[j].centroid_lng }
      );
      if (!nearestPair || km < nearestPair.km) {
        nearestPair = { a: regionCentroids[i].name, b: regionCentroids[j].name, km };
      }
      if (!farthestPair || km > farthestPair.km) {
        farthestPair = { a: regionCentroids[i].name, b: regionCentroids[j].name, km };
      }
    }
  }

  // Average straight-line distance between all unit pairs (sampled if large).
  const units = db.prepare(`SELECT lat, lng FROM units`).all() as { lat: number; lng: number }[];
  let avgUnitDistanceKm: number | null = null;
  if (units.length >= 2) {
    let sum = 0;
    let count = 0;
    const sample = units.length > 60 ? units.slice(0, 60) : units;
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        sum += haversineKm(sample[i], sample[j]);
        count++;
      }
    }
    avgUnitDistanceKm = count > 0 ? sum / count : null;
  }

  return NextResponse.json({
    totalRegions,
    totalUnits,
    totalTeams,
    regionUnitCounts: regionCounts,
    topRegion,
    nearestRegionPair: nearestPair ? { ...nearestPair, km: Number(nearestPair.km.toFixed(1)) } : null,
    farthestRegionPair: farthestPair ? { ...farthestPair, km: Number(farthestPair.km.toFixed(1)) } : null,
    avgUnitDistanceKm: avgUnitDistanceKm !== null ? Number(avgUnitDistanceKm.toFixed(1)) : null,
  });
}
