import { LatLng, haversineKm, estimateMinutesFromKm } from "./geo";

// Public demo servers — free, no API key, but rate-limited and not backed
// by an SLA. Fine for an MVP / low-to-medium volume. For heavier production
// use, self-host OSRM/Nominatim (both open source) or swap these two
// functions for Mapbox/Google Maps equivalents — nothing else in the app
// needs to change. See README.md.
const OSRM_BASE = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const NOMINATIM_BASE = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";

export type RoadResult = { km: number; minutes: number; estimated: boolean };

/** Road distance + duration between two points via OSRM. Falls back to a
 * straight-line estimate if the routing server is unreachable, so the app
 * keeps working (with a visible "estimated" flag) instead of breaking. */
export async function roadDistance(a: LatLng, b: LatLng): Promise<RoadResult> {
  const url = `${OSRM_BASE}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("OSRM: no route found");
    return {
      km: route.distance / 1000,
      minutes: route.duration / 60,
      estimated: false,
    };
  } catch {
    const km = haversineKm(a, b);
    return { km, minutes: estimateMinutesFromKm(km), estimated: true };
  }
}

/** Full pairwise road-distance/duration matrix for a set of points, via
 * OSRM's Table service — one HTTP call instead of N² route calls. Falls
 * back to a haversine-based matrix (flagged as estimated) if unreachable.
 * OSRM's public demo server caps table size, so callers should keep the
 * point count reasonable (a few dozen) for the live demo server. */
export async function roadDistanceMatrix(
  points: LatLng[]
): Promise<{ km: number[][]; minutes: number[][]; estimated: boolean }> {
  if (points.length === 0) return { km: [], minutes: [], estimated: false };
  if (points.length === 1) return { km: [[0]], minutes: [[0]], estimated: false };

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=distance,duration`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const distances: number[][] | null = data?.distances;
    const durations: number[][] | null = data?.durations;
    if (!distances || !durations) throw new Error("OSRM: matriz ausente");

    return {
      km: distances.map((row) => row.map((m) => m / 1000)),
      minutes: durations.map((row) => row.map((s) => s / 60)),
      estimated: false,
    };
  } catch {
    const km = points.map((a) => points.map((b) => haversineKm(a, b)));
    const minutes = km.map((row) => row.map((k) => estimateMinutesFromKm(k)));
    return { km, minutes, estimated: true };
  }
}

export type GeocodeResult = { lat: number; lng: number; displayName: string };

/** Forward geocoding (address text -> coordinates) via Nominatim. */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "mapa-territorios/1.0 (uso interno)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = await res.json();
  const first = data?.[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
}

// --- Overpass API: identificação de bairros/sub-bairros/ruas reais dentro
// de um polígono, a partir de dados do OpenStreetMap. Servidor público
// gratuito, sem chave — mesma filosofia do OSRM/Nominatim acima. ---
const OVERPASS_BASE = process.env.OVERPASS_BASE_URL || "https://overpass-api.de/api/interpreter";

export type OverpassPlace = { name: string; lat: number; lng: number; placeType: string };
export type OverpassStreet = { name: string; lat: number; lng: number };

function polygonFilter(ring: [number, number][]): string {
  // Overpass "poly" filter expects "lat lon lat lon ..." (latitude first),
  // while this app stores rings as [lng, lat] pairs everywhere else.
  return ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
}

async function runOverpassQuery(ql: string): Promise<{ elements: OverpassElement[] }> {
  const res = await fetch(OVERPASS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(ql)}`,
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

function elementPoint(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/** Bairros, sub-bairros e localidades (nós/vias com tag place=...) dentro
 * do polígono informado. */
export async function findPlaces(areaRing: [number, number][]): Promise<OverpassPlace[]> {
  const poly = polygonFilter(areaRing);
  const ql = `[out:json][timeout:50];
(
  node["place"~"^(suburb|neighbourhood|quarter|hamlet|locality)$"]["name"](poly:"${poly}");
  way["place"~"^(suburb|neighbourhood|quarter|hamlet|locality)$"]["name"](poly:"${poly}");
);
out center tags;`;
  const data = await runOverpassQuery(ql);
  const seen = new Set<string>();
  const results: OverpassPlace[] = [];
  for (const el of data.elements) {
    const name = el.tags?.name;
    const placeType = el.tags?.place;
    const point = elementPoint(el);
    if (!name || !placeType || !point) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name: name.trim(), lat: point.lat, lng: point.lng, placeType });
  }
  return results;
}

/** Ruas nomeadas (vias com tag highway=... e name) dentro do polígono
 * informado. Limitado a tipos de via relevantes para navegação/endereço
 * (exclui trilhas, calçadas isoladas, vias em construção etc). */
export async function findStreets(areaRing: [number, number][], limit = 400): Promise<OverpassStreet[]> {
  const poly = polygonFilter(areaRing);
  const highwayTypes = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|primary_link|secondary_link|tertiary_link";
  const ql = `[out:json][timeout:50];
way["highway"~"^(${highwayTypes})$"]["name"](poly:"${poly}");
out center tags;`;
  const data = await runOverpassQuery(ql);
  const seen = new Set<string>();
  const results: OverpassStreet[] = [];
  for (const el of data.elements) {
    const name = el.tags?.name;
    const point = elementPoint(el);
    if (!name || !point) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name: name.trim(), lat: point.lat, lng: point.lng });
    if (results.length >= limit) break;
  }
  return results;
}
