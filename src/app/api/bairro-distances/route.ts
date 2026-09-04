import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BairroDistance } from "@/lib/types";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT
         bd.origin_id, bd.dest_id, bd.km, bd.minutes, bd.estimated, bd.computed_at,
         ro.name AS origin_name, rd.name AS dest_name
       FROM bairro_distances bd
       JOIN regions ro ON ro.id = bd.origin_id
       JOIN regions rd ON rd.id = bd.dest_id
       ORDER BY ro.name COLLATE NOCASE, rd.name COLLATE NOCASE`
    )
    .all() as (Omit<BairroDistance, "estimated"> & { estimated: number })[];

  const distances: BairroDistance[] = rows.map((r) => ({ ...r, estimated: !!r.estimated }));
  return NextResponse.json(distances);
}
