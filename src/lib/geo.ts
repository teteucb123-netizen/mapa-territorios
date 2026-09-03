export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Centroid of a simple polygon given as [lng, lat] pairs (GeoJSON ring order).
 * Falls back to the vertex average for degenerate (near-zero-area) shapes,
 * e.g. a two-point line, which is good enough for our "reference point" use.
 */
export function polygonCentroid(ringLngLat: [number, number][]): LatLng {
  if (ringLngLat.length === 0) throw new Error("Empty polygon");
  if (ringLngLat.length < 3) {
    const avgLat = ringLngLat.reduce((s, p) => s + p[1], 0) / ringLngLat.length;
    const avgLng = ringLngLat.reduce((s, p) => s + p[0], 0) / ringLngLat.length;
    return { lat: avgLat, lng: avgLng };
  }

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ringLngLat.length; i++) {
    const [x0, y0] = ringLngLat[i];
    const [x1, y1] = ringLngLat[(i + 1) % ringLngLat.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  area = area / 2;
  if (Math.abs(area) < 1e-12) {
    const avgLat = ringLngLat.reduce((s, p) => s + p[1], 0) / ringLngLat.length;
    const avgLng = ringLngLat.reduce((s, p) => s + p[0], 0) / ringLngLat.length;
    return { lat: avgLat, lng: avgLng };
  }

  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { lat: cy, lng: cx };
}

/** Rough estimated driving time from straight-line km, used only as a
 * fallback when the OSRM road-routing call is unavailable. Assumes a mixed
 * urban/suburban average speed and a road-vs-straight-line detour factor. */
export function estimateMinutesFromKm(km: number): number {
  const detourFactor = 1.3;
  const avgSpeedKmH = 32;
  return (km * detourFactor * 60) / avgSpeedKmH;
}
