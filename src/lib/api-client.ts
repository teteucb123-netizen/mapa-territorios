import { Area, Region, Team, Unit, RouteRecord } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  areas: {
    list: () => fetch("/api/areas").then((r) => j<Area[]>(r)),
    create: (data: { name?: string; geojson: [number, number][] }) =>
      fetch("/api/areas", { method: "POST", body: JSON.stringify(data) }).then((r) => j<Area>(r)),
    update: (id: string, data: Partial<{ name: string; geojson: [number, number][] }>) =>
      fetch(`/api/areas/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => j<Area>(r)),
    remove: (id: string) => fetch(`/api/areas/${id}`, { method: "DELETE" }).then((r) => j(r)),
  },
  regions: {
    list: () => fetch("/api/regions").then((r) => j<Region[]>(r)),
    create: (data: Partial<Region>) =>
      fetch("/api/regions", { method: "POST", body: JSON.stringify(data) }).then((r) => j<Region>(r)),
    update: (id: string, data: Partial<Region>) =>
      fetch(`/api/regions/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => j<Region>(r)),
    remove: (id: string) => fetch(`/api/regions/${id}`, { method: "DELETE" }).then((r) => j(r)),
  },
  units: {
    list: (filters?: Record<string, string>) =>
      fetch(`/api/units${filters ? "?" + new URLSearchParams(filters).toString() : ""}`).then((r) => j<Unit[]>(r)),
    create: (data: Partial<Unit>) =>
      fetch("/api/units", { method: "POST", body: JSON.stringify(data) }).then((r) => j<Unit>(r)),
    update: (id: string, data: Partial<Unit>) =>
      fetch(`/api/units/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => j<Unit>(r)),
    remove: (id: string) => fetch(`/api/units/${id}`, { method: "DELETE" }).then((r) => j(r)),
  },
  teams: {
    list: () => fetch("/api/teams").then((r) => j<Team[]>(r)),
    create: (data: Partial<Team>) =>
      fetch("/api/teams", { method: "POST", body: JSON.stringify(data) }).then((r) => j<Team>(r)),
    update: (id: string, data: Partial<Team>) =>
      fetch(`/api/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }).then((r) => j<Team>(r)),
    remove: (id: string) => fetch(`/api/teams/${id}`, { method: "DELETE" }).then((r) => j(r)),
  },
  geocode: (q: string) => fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => j<{ lat: number; lng: number; displayName: string }>(r)),
  distance: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) =>
    fetch("/api/distance", { method: "POST", body: JSON.stringify({ origin, destination }) }).then((r) =>
      j<{ straight_line_km: number; road_km: number; road_minutes: number; road_estimated: boolean }>(r)
    ),
  distanceMatrix: (type: "units" | "regions", region_id?: string) =>
    fetch(`/api/distance-matrix?type=${type}${region_id ? `&region_id=${region_id}` : ""}`).then((r) =>
      j<{ labels: string[]; ids: string[]; colors?: string[]; km: number[][]; minutes: number[][]; estimated: boolean }>(r)
    ),
  routePlan: {
    list: () => fetch("/api/route-plan").then((r) => j<RouteRecord[]>(r)),
    create: (data: { name?: string; origin_unit_id: string; stop_unit_ids: string[] }) =>
      fetch("/api/route-plan", { method: "POST", body: JSON.stringify(data) }).then((r) =>
        j<RouteRecord & { sequence: { id: string; name: string; lat: number; lng: number }[]; estimated: boolean }>(r)
      ),
    remove: (id: string) => fetch(`/api/route-plan/${id}`, { method: "DELETE" }).then((r) => j(r)),
  },
  dashboard: () =>
    fetch("/api/dashboard").then((r) =>
      j<{
        totalRegions: number;
        totalUnits: number;
        totalTeams: number;
        regionUnitCounts: { id: string; name: string; color: string; unit_count: number }[];
        topRegion: { id: string; name: string; color: string; unit_count: number } | null;
        nearestRegionPair: { a: string; b: string; km: number } | null;
        farthestRegionPair: { a: string; b: string; km: number } | null;
        avgUnitDistanceKm: number | null;
      }>(r)
    ),
};
