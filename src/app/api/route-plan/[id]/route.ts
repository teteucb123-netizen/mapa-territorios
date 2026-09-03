import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = db.prepare(`SELECT id FROM routes WHERE id = ?`).get(id);
  if (!existing) return NextResponse.json({ error: "Rota não encontrada." }, { status: 404 });
  db.prepare(`DELETE FROM routes WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
