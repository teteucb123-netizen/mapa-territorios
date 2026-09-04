import { Area, BairroDistance, Region, Unit } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export type DiscoverResult = {
  bairros: number;
  subBairros: number;
  ruas: number;
  distancesComputed: number;
  distancesEstimated: boolean;
};

export const api = {
  areas: {
    list: () => fetch("/api/areas").then((r) => j<Area[]>(r)),
    create: (data: { name?: string; geojson: [number, number][] }) =>
      fetch("/api/areas", { method: "POST", body: JSON.stringify(data) }).then((r) => j<Area>(r)),
    update: (id: string, data: Partial<{ name: string; geojson: [number, number][] }>) =>
      fetch(`/api/areas/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => j<Area>(r)),
  },
  regions: {
    list: () => fetch("/api/regions").then((r) => j<Region[]>(r)),
  },
  units: {
    list: (filters?: Record<string, string>) =>
      fetch(`/api/units${filters ? "?" + new URLSearchParams(filters).toString() : ""}`).then((r) => j<Unit[]>(r)),
  },
  geocode: (q: string) =>
    fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => j<{ lat: number; lng: number; displayName: string }>(r)),
  bairroDistances: {
    list: () => fetch("/api/bairro-distances").then((r) => j<BairroDistance[]>(r)),
  },
  discover: () => fetch("/api/discover", { method: "POST" }).then((r) => j<DiscoverResult>(r)),
};
