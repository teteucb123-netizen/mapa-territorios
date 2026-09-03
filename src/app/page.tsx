"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MapView from "@/components/MapViewClient";
import type { DrawTarget, MapMode } from "@/components/MapView";
import RegionsPanel from "@/components/RegionsPanel";
import UnitsPanel from "@/components/UnitsPanel";
import TeamsPanel from "@/components/TeamsPanel";
import DistanceMatrixPanel from "@/components/DistanceMatrixPanel";
import RoutePlannerPanel from "@/components/RoutePlannerPanel";
import DashboardPanel from "@/components/DashboardPanel";
import { Button, Select } from "@/components/ui";
import { api } from "@/lib/api-client";
import { Area, Region, Team, Unit } from "@/lib/types";

type Tab = "mapa" | "regioes" | "unidades" | "equipes" | "distancias" | "rotas" | "dashboard";
type Sequence = { id: string; name: string; lat: number; lng: number }[];

const TABS: { id: Tab; label: string }[] = [
  { id: "mapa", label: "Mapa" },
  { id: "regioes", label: "Regiões" },
  { id: "unidades", label: "Unidades" },
  { id: "equipes", label: "Equipes" },
  { id: "distancias", label: "Distâncias" },
  { id: "rotas", label: "Rotas" },
  { id: "dashboard", label: "Dashboard" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("mapa");
  const [areas, setAreas] = useState<Area[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [mapMode, setMapMode] = useState<MapMode>("normal");
  const [drawTarget, setDrawTarget] = useState<DrawTarget>(null);
  const [drawArmedToken, setDrawArmedToken] = useState(0);
  const [placingUnit, setPlacingUnit] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [focusUnitId, setFocusUnitId] = useState<string | null>(null);

  const [distanceSelection, setDistanceSelection] = useState<Unit[]>([]);
  const [distanceResult, setDistanceResult] = useState<{
    straight_line_km: number;
    road_km: number;
    road_minutes: number;
    road_estimated: boolean;
  } | null>(null);

  const [routeSequence, setRouteSequence] = useState<Sequence | null>(null);

  const fetchAll = useCallback(async () => {
    const [a, r, u, t] = await Promise.all([api.areas.list(), api.regions.list(), api.units.list(), api.teams.list()]);
    setAreas(a);
    setRegions(r);
    setUnits(u);
    setTeams(t);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    fetchAll();
  }, [fetchAll]);

  function requestDrawArea() {
    setDrawTarget("area");
    setDrawArmedToken((n) => n + 1);
    setTab("mapa");
  }

  function requestDrawRegion(regionId: string) {
    setDrawTarget({ regionId });
    setDrawArmedToken((n) => n + 1);
    setMapMode("regions");
    setTab("mapa");
  }

  async function handlePolygonDrawn(coords: [number, number][]) {
    if (drawTarget === "area") {
      if (areas.length > 0) await api.areas.update(areas[0].id, { geojson: coords });
      else await api.areas.create({ name: "Área de atuação", geojson: coords });
    } else if (drawTarget && typeof drawTarget === "object") {
      await api.regions.update(drawTarget.regionId, { geojson: coords });
    }
    setDrawTarget(null);
    await fetchAll();
  }

  function handleMapClickForUnit(lat: number, lng: number) {
    setPendingCoords({ lat, lng });
    setPlacingUnit(false);
    setTab("unidades");
  }

  async function handleUnitDragEnd(unitId: string, lat: number, lng: number) {
    await api.units.update(unitId, { lat, lng });
    await fetchAll();
  }

  async function handleUnitClick(unit: Unit) {
    setFocusUnitId(unit.id);
    if (mapMode !== "distances") return;

    setDistanceSelection((prev) => {
      const exists = prev.some((u) => u.id === unit.id);
      let next: Unit[];
      if (exists) next = prev.filter((u) => u.id !== unit.id);
      else if (prev.length >= 2) next = [prev[1], unit];
      else next = [...prev, unit];
      return next;
    });
  }

  useEffect(() => {
    if (distanceSelection.length === 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale result before the new distance call resolves
      setDistanceResult(null);
      api.distance(
        { lat: distanceSelection[0].lat, lng: distanceSelection[0].lng },
        { lat: distanceSelection[1].lat, lng: distanceSelection[1].lng }
      ).then(setDistanceResult);
    } else {
      setDistanceResult(null);
    }
  }, [distanceSelection]);

  const drawTargetLabel = useMemo(() => {
    if (drawTarget === "area") return "Área de atuação";
    if (drawTarget && typeof drawTarget === "object") {
      return regions.find((r) => r.id === drawTarget.regionId)?.name || "região";
    }
    return null;
  }, [drawTarget, regions]);

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-white">Mapa de Territórios</h1>
          <p className="text-xs text-slate-400">Regiões, unidades, distâncias e rotas</p>
        </div>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {!loaded ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Carregando dados…</div>
        ) : (
          <>
            {tab === "mapa" && (
              <div className="relative h-full min-h-[560px]">
                <MapView
                  areas={areas}
                  regions={regions}
                  units={units}
                  mode={mapMode}
                  drawTarget={drawTarget}
                  onPolygonDrawn={handlePolygonDrawn}
                  drawArmedToken={drawArmedToken}
                  placingUnit={placingUnit}
                  onMapClickForUnit={handleMapClickForUnit}
                  onUnitDragEnd={handleUnitDragEnd}
                  onUnitClick={handleUnitClick}
                  distanceSelection={distanceSelection}
                  routeSequence={mapMode === "routes" ? routeSequence : null}
                />

                <div className="pointer-events-none absolute inset-0">
                  <div className="pointer-events-auto absolute left-3 top-3 w-72 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500">Modo de visualização</span>
                      <Select value={mapMode} onChange={(e) => setMapMode(e.target.value as MapMode)}>
                        <option value="normal">Normal</option>
                        <option value="regions">Regiões</option>
                        <option value="distances">Distâncias</option>
                        <option value="routes">Rotas</option>
                        <option value="concentration">Concentração</option>
                      </Select>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Área de atuação</span>
                      <Button variant="secondary" className="w-full" onClick={requestDrawArea}>
                        {areas.length > 0 ? "Redesenhar área" : "Desenhar área"}
                      </Button>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Unidades</span>
                      <Button
                        variant={placingUnit ? "primary" : "secondary"}
                        className="w-full"
                        onClick={() => setPlacingUnit((v) => !v)}
                      >
                        {placingUnit ? "Clique no mapa para posicionar…" : "Adicionar unidade no mapa"}
                      </Button>
                      <p className="mt-1 text-xs text-slate-400">Ou arraste um marcador existente para reposicioná-lo.</p>
                    </div>

                    {drawTargetLabel && (
                      <div className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
                        Desenhando: <strong>{drawTargetLabel}</strong>. Clique no mapa para marcar os vértices e clique duplo para finalizar.
                      </div>
                    )}

                    {mapMode === "distances" && (
                      <div className="border-t border-slate-100 pt-3">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Comparar distância</span>
                        <p className="text-xs text-slate-500">Clique em duas unidades no mapa.</p>
                        {distanceSelection.length > 0 && (
                          <ul className="mt-1 text-xs text-slate-600">
                            {distanceSelection.map((u) => (
                              <li key={u.id}>• {u.name}</li>
                            ))}
                          </ul>
                        )}
                        {distanceResult && (
                          <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                            <div>Linha reta: <strong>{distanceResult.straight_line_km} km</strong></div>
                            <div>Por estrada: <strong>{distanceResult.road_km} km · {Math.round(distanceResult.road_minutes)} min</strong></div>
                            {distanceResult.road_estimated && (
                              <div className="mt-1 text-amber-600">valor estimado (serviço de rota indisponível)</div>
                            )}
                          </div>
                        )}
                        {distanceSelection.length > 0 && (
                          <Button variant="ghost" className="mt-1 w-full" onClick={() => setDistanceSelection([])}>
                            Limpar seleção
                          </Button>
                        )}
                      </div>
                    )}

                    {mapMode === "routes" && routeSequence && (
                      <div className="border-t border-slate-100 pt-3">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Rota exibida</span>
                        <p className="text-xs text-slate-500">{routeSequence.length} ponto(s) · veja a sequência na aba Rotas.</p>
                        <Button variant="ghost" className="mt-1 w-full" onClick={() => setRouteSequence(null)}>
                          Ocultar rota
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "regioes" && (
              <RegionsPanel regions={regions} teams={teams} units={units} onChange={fetchAll} onRequestDraw={requestDrawRegion} />
            )}

            {tab === "unidades" && (
              <UnitsPanel
                units={units}
                regions={regions}
                teams={teams}
                onChange={fetchAll}
                pendingCoords={pendingCoords}
                onConsumePendingCoords={() => setPendingCoords(null)}
                focusUnitId={focusUnitId}
              />
            )}

            {tab === "equipes" && <TeamsPanel teams={teams} onChange={fetchAll} />}

            {tab === "distancias" && <DistanceMatrixPanel regions={regions} />}

            {tab === "rotas" && (
              <RoutePlannerPanel
                units={units}
                onViewOnMap={(seq) => {
                  setRouteSequence(seq);
                  setMapMode("routes");
                  setTab("mapa");
                }}
              />
            )}

            {tab === "dashboard" && <DashboardPanel />}
          </>
        )}
      </main>
    </div>
  );
}
