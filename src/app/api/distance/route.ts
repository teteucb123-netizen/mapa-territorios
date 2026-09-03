import { NextRequest, NextResponse } from "next/server";
import { haversineKm } from "@/lib/geo";
import { roadDistance } from "@/lib/routing";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { origin, destination } = body;

  if (
    !origin || !destination ||
    typeof origin.lat !== "number" || typeof origin.lng !== "number" ||
    typeof destination.lat !== "number" || typeof destination.lng !== "number"
  ) {
    return NextResponse.json(
      { error: "Informe 'origin' e 'destination', cada um com lat/lng numéricos." },
      { status: 400 }
    );
  }

  const straightKm = haversineKm(origin, destination);
  const road = await roadDistance(origin, destination);

  return NextResponse.json({
    straight_line_km: Number(straightKm.toFixed(2)),
    road_km: Number(road.km.toFixed(2)),
    road_minutes: Number(road.minutes.toFixed(1)),
    road_estimated: road.estimated,
  });
}
