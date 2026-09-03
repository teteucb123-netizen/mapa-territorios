import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/routing";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ error: "Informe um endereço com pelo menos 3 caracteres." }, { status: 400 });
  }

  try {
    const result = await geocodeAddress(q);
    if (!result) {
      return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Serviço de geocodificação indisponível no momento. Tente novamente ou marque o ponto manualmente no mapa." },
      { status: 502 }
    );
  }
}
