export type Region = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  geojson: [number, number][] | null; // ring de [lng, lat] — normalmente ausente para bairros vindos do Overpass (só ponto central)
  responsible: string | null;
  notes: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  parent_id: string | null; // null = Bairro (nível 1); preenchido = Sub-bairro (nível 2, filho de um Bairro)
  source: "overpass" | "manual";
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
  type: string | null;
  phone: string | null;
  notes: string | null;
  source: "overpass" | "manual";
  created_at: string;
  updated_at: string;
};

export type Area = {
  id: string;
  name: string;
  geojson: [number, number][]; // ring de [lng, lat]
  created_at: string;
  updated_at: string;
};

export type BairroDistance = {
  origin_id: string;
  dest_id: string;
  origin_name: string;
  dest_name: string;
  km: number;
  minutes: number | null;
  estimated: boolean;
  computed_at: string;
};
