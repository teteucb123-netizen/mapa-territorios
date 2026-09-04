"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "@/components/MapViewClient";
import type { ConnectorLine, FlyTarget, SearchMarker } from "@/components/MapView";
import BairrosPanel from "@/components/BairrosPanel";
import DistanciasPanel from "@/components/DistanciasPanel";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api-client";
import { Area, Region, Unit } from "@/lib/types";

type Tab = "mapa" | "bairros" | "distancias";

export default function Home() {
  const [tab, setTab] = useState<Tab>("mapa");
  const [areas, setAreas] = useState<Area[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [drawArmedToken, setDrawArmedToken] = useState(0);

  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSummary, setDiscoverSummary] = useState<string | null>(null);

  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const flyTokenRef = useRef(0);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [highlightRegionIds, setHighlightRegionIds] = useState<string[]>([]);
  const [highlightUnitId, setHighlightUnitId] = useState<string | null>(null);
  const [connectorLine, setConnectorLine] = useState<ConnectorLine | null>(null);
  const [searchMarker, setSearchMarker] = useState<SearchMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchAll = useCallback(async () => {
    const [a, r, u] = await Promise.all([api.areas.list(), api.regions.list(), api.units.list()]);
    setAreas(a);
    setRegions(r);
    setUnits(u);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    fetchAll();
  }, [fetchAll]);

  function requestDrawArea() {
    setDrawArmedToken((n) => n + 1);
  }

  async function handlePolygonDrawn(coords: [number, number][]) {
    if (areas.length > 0) await api.areas.update(areas[0].id, { geojson: coords });
    else await api.areas.create({ name: "Área de atuação", geojson: coords });
    await fetchAll();
  }

  async function runDiscovery() {
    setDiscovering(true);
    setDiscoverError(null);
    setDiscoverSummary(null);
    try {
      const result = await api.discover();
      setDiscoverSummary(
        `${result.bairros} bairro(s), ${result.subBairros} sub-bairro(s) e ${result.ruas} rua(s) identificados` +
          (result.distancesComputed > 0 ? ` · distâncias entre bairros calculadas${result.distancesEstimated ? " (estimadas)" : ""}` : "")
      );
      await fetchAll();
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "Erro ao identificar bairros e ruas.");
    } finally {
      setDiscovering(false);
    }
  }

  function flyToPoint(lat: number, lng: number, zoom = 16) {
    flyTokenRef.current += 1;
    setFlyTo({ token: flyTokenRef.current, lat, lng, zoom });
  }

  function flyToBoundsCoords(coords: [number, number][], zoom?: number) {
    flyTokenRef.current += 1;
    setFlyTo({ token: flyTokenRef.current, bounds: coords, zoom });
  }

  // LISTA → MAPA: localizar e destacar um bairro/sub-bairro.
  function focusRegion(region: Region) {
    setHighlightRegionIds([region.id]);
    setHighlightUnitId(null);
    setConnectorLine(null);
    setSearchMarker(null);
    if (region.geojson && region.geojson.length > 0) {
      flyToBoundsCoords(region.geojson, region.parent_id ? 16 : 14);
    } else if (region.centroid_lat != null && region.centroid_lng != null) {
      flyToPoint(region.centroid_lat, region.centroid_lng, region.parent_id ? 16 : 14);
    }
    setTab("mapa");
  }

  // LISTA → MAPA: localizar e destacar uma rua.
  function focusUnit(unit: Unit) {
    setHighlightUnitId(unit.id);
    setHighlightRegionIds([]);
    setConnectorLine(null);
    setSearchMarker(null);
    flyToPoint(unit.lat, unit.lng, 17);
    setTab("mapa");
  }

  // MAPA → LISTA: clicar num bairro/rua no mapa destaca o item correspondente
  // no painel lateral, sem forçar navegação.
  function handleRegionMapClick(region: Region) {
    setHighlightRegionIds([region.id]);
    setHighlightUnitId(null);
  }
  function handleUnitMapClick(unit: Unit) {
    setHighlightUnitId(unit.id);
    setHighlightRegionIds([]);
  }

  // Aba Distâncias: clicar num par "Bairro A → Bairro B" mostra os dois
  // conectados por uma linha no mapa.
  function handleSelectPair(originId: string, destId: string, km: number) {
    const a = regions.find((r) => r.id === originId);
    const b = regions.find((r) => r.id === destId);
    if (!a || !b || a.centroid_lat == null || a.centroid_lng == null || b.centroid_lat == null || b.centroid_lng == null) return;
    setConnectorLine({
      a: { lat: a.centroid_lat, lng: a.centroid_lng, name: a.name },
      b: { lat: b.centroid_lat, lng: b.centroid_lng, name: b.name },
      label: `${km} km`,
    });
    setHighlightRegionIds([a.id, b.id]);
    setHighlightUnitId(null);
    setSearchMarker(null);
    flyToBoundsCoords(
      [
        [a.centroid_lng, a.centroid_lat],
        [b.centroid_lng, b.centroid_lat],
      ],
      13
    );
    setTab("mapa");
  }

  function resetToFullArea() {
    setResetViewToken((n) => n + 1);
    setHighlightRegionIds([]);
    setHighlightUnitId(null);
    setConnectorLine(null);
    setSearchMarker(null);
  }

  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);

    const qLower = q.toLowerCase();
    const score = (name: string) => {
      const n = name.toLowerCase();
      if (!n) return 0;
      if (n === qLower) return 3;
      if (n.startsWith(qLower)) return 2;
      if (n.includes(qLower)) return 1;
      return 0;
    };

    let bestRegion: Region | undefined;
    let bestRegionScore = 0;
    for (const r of regions) {
      const s = score(r.name);
      if (s > bestRegionScore) {
        bestRegionScore = s;
        bestRegion = r;
      }
    }

    let bestUnit: Unit | undefined;
    let bestUnitScore = 0;
    for (const u of units) {
      const s = score(u.name);
      if (s > bestUnitScore) {
        bestUnitScore = s;
        bestUnit = u;
      }
    }

    if (bestRegion && bestRegionScore > 0 && bestRegionScore >= bestUnitScore) {
      focusRegion(bestRegion);
      setSearching(false);
      return;
    }
    if (bestUnit && bestUnitScore > 0) {
      focusUnit(bestUnit);
      setSearching(false);
      return;
    }

    try {
      const result = await api.geocode(q);
      setSearchMarker({ lat: result.lat, lng: result.lng, label: result.displayName });
      setHighlightRegionIds([]);
      setHighlightUnitId(null);
      setConnectorLine(null);
      flyToPoint(result.lat, result.lng, 16);
      setTab("mapa");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Nada encontrado. Tente outro termo ou um endereço completo.");
    } finally {
      setSearching(false);
    }
  }

  const selectedRegionId = highlightRegionIds.length === 1 ? highlightRegionIds[0] : null;

  const bairroCount = useMemo(() => regions.filter((r) => !r.parent_id).length, [regions]);

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-white">Mapa de Territórios</h1>
          <p className="text-xs text-slate-400">Bairros, sub-bairros e ruas — distâncias entre bairros</p>
        </div>
        <nav className="flex gap-1">
          {([
            ["mapa", "🗺️ Mapa"],
            ["bairros", "📍 Bairros e Sub-bairros"],
            ["distancias", "📏 Distâncias entre Bairros"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {!loaded ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Carregando dados…</div>
        ) : tab === "mapa" ? (
          <div className="relative h-full min-h-[560px]">
            <MapView
              areas={areas}
              regions={regions}
              units={units}
              drawArmedToken={drawArmedToken}
              onPolygonDrawn={handlePolygonDrawn}
              onRegionClick={handleRegionMapClick}
              onUnitClick={handleUnitMapClick}
              highlightRegionIds={highlightRegionIds}
              highlightUnitId={highlightUnitId}
              connectorLine={connectorLine}
              flyTo={flyTo}
              resetViewToken={resetViewToken}
              searchMarker={searchMarker}
            />

            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto absolute left-3 top-3 w-72 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div>
                  <span className="mb-1 block text-xs font-medium text-slate-500">🔎 Pesquisar bairro, rua ou endereço</span>
                  <div className="flex gap-1.5">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runSearch();
                      }}
                      placeholder="Ex.: Campo Grande, Av. Dom João VI…"
                    />
                    <Button variant="secondary" onClick={runSearch} disabled={searching}>
                      {searching ? "…" : "Ir"}
                    </Button>
                  </div>
                  {searchError && <p className="mt-1 text-xs text-red-600">{searchError}</p>}
                </div>

                <Button variant="secondary" className="w-full" onClick={resetToFullArea}>
                  ⌂ Voltar para a área completa
                </Button>

                <div className="border-t border-slate-100 pt-3">
                  <Button variant="secondary" className="w-full" onClick={requestDrawArea}>
                    Redesenhar área traçada
                  </Button>
                  <p className="mt-1 text-xs text-slate-400">O traçado atual já vem pré-carregado — só redesenhe se precisar ajustar.</p>
                </div>

                {connectorLine && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Bairros conectados</span>
                    <p className="text-xs text-slate-600">
                      {connectorLine.a.name} ↔ {connectorLine.b.name}
                      {connectorLine.label && <> — {connectorLine.label}</>}
                    </p>
                    <Button variant="ghost" className="mt-1 w-full" onClick={() => setConnectorLine(null)}>
                      Limpar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : tab === "bairros" ? (
          <div>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
              <Button onClick={runDiscovery} disabled={discovering}>
                {discovering ? "Identificando…" : bairroCount > 0 ? "Atualizar bairros e ruas" : "Identificar bairros e ruas"}
              </Button>
              {discoverError && <span className="text-xs text-red-600">{discoverError}</span>}
              {discoverSummary && <span className="text-xs text-teal-700">{discoverSummary}</span>}
            </div>
            <BairrosPanel
              regions={regions}
              units={units}
              onSelectRegion={focusRegion}
              onSelectUnit={focusUnit}
              selectedRegionId={selectedRegionId}
              selectedUnitId={highlightUnitId}
            />
          </div>
        ) : (
          <DistanciasPanel regions={regions} onSelectPair={handleSelectPair} />
        )}
      </main>
    </div>
  );
}
