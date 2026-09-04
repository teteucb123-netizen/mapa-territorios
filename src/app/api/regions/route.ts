import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toRegion } from "@/lib/serializers";

export async function GET() {
  const rows = db.prepare(`SELECT * FROM regions ORDER BY name COLLATE NOCASE`).all();
  return NextResponse.json(rows.map(toRegion));
}
