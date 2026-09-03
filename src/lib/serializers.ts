import { Area, Region, Team, Unit, RouteRecord } from "./types";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTeam(row: any): Team {
  return { ...row, members: parseJson<string[]>(row.members, []) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toRegion(row: any): Region {
  return { ...row, geojson: row.geojson ? parseJson<[number, number][]>(row.geojson, []) : null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toUnit(row: any): Unit {
  return { ...row };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toArea(row: any): Area {
  return { ...row, geojson: parseJson<[number, number][]>(row.geojson, []) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toRoute(row: any): RouteRecord {
  return { ...row, stop_unit_ids: parseJson<string[]>(row.stop_unit_ids, []) };
}
