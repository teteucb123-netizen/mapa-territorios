import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toUnit } from "@/lib/serializers";

export async function GET(req: NextRequest) {
  const regionId = req.nextUrl.searchParams.get("region_id");
  if (regionId) {
    const rows = db.prepare(`SELECT * FROM units WHERE region_id = ? ORDER BY name COLLATE NOCASE`).all(regionId);
    return NextResponse.json(rows.map(toUnit));
  }
  const rows = db.prepare(`SELECT * FROM units ORDER BY name COLLATE NOCASE`).all();
  return NextResponse.json(rows.map(toUnit));
}
