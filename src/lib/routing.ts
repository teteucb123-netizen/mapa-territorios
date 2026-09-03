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

/** Optimized visiting order for one origin + several stops, via OSRM's
 * Trip service (solves an open TSP). Returns stop indices (into `stops`)
 * in the suggested visiting order, plus total distance/time. Falls back to
 * the original input order, estimated via haversine, if OSRM is unreachable. */
export async function optimizedTrip(
  origin: LatLng,
  stops: LatLng[]
): Promise<{ order: number[]; km: number; minutes: number; estimated: boolean }> {
  const points = [origin, ...stops];
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const trip = data?.trips?.[0];
    const waypoints = data?.waypoints;
    if (!trip || !waypoints) throw new Error("OSRM: no trip found");

    // waypoints[i].waypoint_index tells us the visiting order for input
    // point i (0 = origin). We want stop order (indices into `stops`,
    // i.e. input index - 1), sorted by visiting sequence.
    const stopWaypoints = waypoints
      .map((w: { waypoint_index: number }, inputIdx: number) => ({ inputIdx, seq: w.waypoint_index }))
      .filter((w: { inputIdx: number }) => w.inputIdx !== 0)
      .sort((a: { seq: number }, b: { seq: number }) => a.seq - b.seq)
      .map((w: { inputIdx: number }) => w.inputIdx - 1);

    return {
      order: stopWaypoints,
      km: trip.distance / 1000,
      minutes: trip.duration / 60,
      estimated: false,
    };
  } catch {
    // Fallback: simple nearest-neighbor heuristic on straight-line distance.
    const remaining = stops.map((s, i) => ({ ...s, i }));
    const order: number[] = [];
    let current = origin;
    let totalKm = 0;
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestKm = Infinity;
      remaining.forEach((p, idx) => {
        const d = haversineKm(current, p);
        if (d < bestKm) {
          bestKm = d;
          bestIdx = idx;
        }
      });
      const next = remaining.splice(bestIdx, 1)[0];
      order.push(next.i);
      totalKm += bestKm;
      current = next;
    }
    return { order, km: totalKm, minutes: estimateMinutesFromKm(totalKm), estimated: true };
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
