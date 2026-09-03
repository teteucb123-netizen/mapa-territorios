export type Team = {
  id: string;
  name: string;
  responsible: string | null;
  members: string[];
  vehicle: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Region = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  geojson: [number, number][] | null; // ring of [lng, lat]
  responsible: string | null;
  team_id: string | null;
  notes: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  parent_id: string | null; // null = Bairro (nível 1); preenchido = Sub-bairro (nível 2, filho de um Bairro)
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  cep: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  region_id: string | null;
  responsible: string | null;
  team_id: string | null;
  type: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Area = {
  id: string;
  name: string;
  geojson: [number, number][]; // ring of [lng, lat]
  created_at: string;
  updated_at: string;
};

export type RouteRecord = {
  id: string;
  name: string;
  origin_unit_id: string | null;
  stop_unit_ids: string[];
  total_km: number | null;
  total_min: number | null;
  created_at: string;
};
