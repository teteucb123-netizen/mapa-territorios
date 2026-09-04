"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
import { Area, Region, Unit } from "@/lib/types";

export type DrawTarget = "area" | null;

export type FlyTarget = {
  token: number; // bump to re-trigger even if lat/lng/bounds are unchanged
  lat?: number;
  lng?: number;
  zoom?: number;
  bounds?: [number, number][]; // ring of [lng, lat] — if present, takes priority over lat/lng
};

export type ConnectorLine = {
  a: { lat: number; lng: number; name: string };
  b: { lat: number; lng: number; name: string };
  label?: string;
};

export type SearchMarker = { lat: number; lng: number; label: string };

// Ruas só aparecem a partir deste nível de zoom, para não poluir a visão
// geral — reflete o comportamento "aproximo para ver as ruas" do pedido.
const RUA_MIN_ZOOM = 15;

type Props = {
  areas: Area[];
  regions: Region[];
  units: Unit[];
  drawArmedToken: number; // bump this to (re)arm the polygon draw tool (redesenhar área)
  onPolygonDrawn: (coords: [number, number][]) => void;
  onRegionClick: (region: Region) => void;
  onUnitClick: (unit: Unit) => void;
  highlightRegionIds: string[];
  highlightUnitId: string | null;
  connectorLine: ConnectorLine | null;
  flyTo: FlyTarget | null;
  resetViewToken: number;
  searchMarker: SearchMarker | null;
};

function regionLabelIcon(region: Region, highlighted: boolean) {
  const isSub = !!region.parent_id;
  return L.divIcon({
    className: "",
    html: `<div style="
      display:inline-flex;align-items:center;gap:4px;white-space:nowrap;
      background:${region.color};color:white;
      font-size:${isSub ? "10px" : "12px"};font-weight:${isSub ? 500 : 700};
      padding:${isSub ? "2px 7px" : "4px 10px"};border-radius:9999px;
      box-shadow:0 1px 4px rgba(0,0,0,.45);
      ${highlighted ? "outline:3px solid #facc15;" : "border:1.5px solid rgba(255,255,255,.8);"}
    ">${escapeHtml(region.name)}</div>`,
    iconSize: undefined,
    iconAnchor: [isSub ? 30 : 40, isSub ? 10 : 12],
  });
}

function unitIcon(highlighted: boolean) {
  const size = highlighted ? 14 : 9;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;background:#0f172a;border:2px solid white;border-radius:50%;
      box-shadow:0 1px 3px rgba(0,0,0,.5);
      ${highlighted ? "outline:3px solid #facc15;" : ""}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapView({
  areas,
  regions,
  units,
  drawArmedToken,
  onPolygonDrawn,
  onRegionClick,
  onUnitClick,
  highlightRegionIds,
  highlightUnitId,
  connectorLine,
  flyTo,
  resetViewToken,
  searchMarker,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const regionsLayerRef = useRef<L.LayerGroup | null>(null);
  const unitsLayerRef = useRef<L.LayerGroup | null>(null);
  const connectorLayerRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null);

  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const areasRef = useRef(areas);
  const regionsRef = useRef(regions);
  const renderUnitsRef = useRef<() => void>(() => {});

  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
    areasRef.current = areas;
    regionsRef.current = regions;
  });

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Centro padrão: área de atuação na Zona Oeste do Rio (Guaratiba/Paciência).
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-22.93, -43.62], 12);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    areaLayerRef.current = L.layerGroup().addTo(map);
    regionsLayerRef.current = L.layerGroup().addTo(map);
    unitsLayerRef.current = L.layerGroup().addTo(map);
    connectorLayerRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);

    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.Polygon }).layer;
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
        (ll) => [Number(ll.lng.toFixed(6)), Number(ll.lat.toFixed(6))] as [number, number]
      );
      onPolygonDrawnRef.current(latlngs);
    });

    map.on("zoomend", () => renderUnitsRef.current());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Arm the polygon draw tool (só usado para redesenhar a área traçada).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawArmedToken === 0) return;
    if (drawHandlerRef.current) drawHandlerRef.current.disable();
    const handler = new L.Draw.Polygon(map as unknown as L.DrawMap, {
      shapeOptions: { color: "#16a34a" },
      showArea: true,
    });
    handler.enable();
    drawHandlerRef.current = handler;
  }, [drawArmedToken]);

  // Fly to a requested target — bairro/sub-bairro/rua selecionado ou
  // endereço geocodificado. `token` força o efeito a rodar de novo mesmo
  // clicando duas vezes seguidas no mesmo item.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.bounds && flyTo.bounds.length >= 1) {
      const latlngs = flyTo.bounds.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (latlngs.length === 1) map.flyTo(latlngs[0], flyTo.zoom ?? 16, { duration: 1 });
      else map.flyToBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: flyTo.zoom ?? 16, duration: 1 });
    } else if (typeof flyTo.lat === "number" && typeof flyTo.lng === "number") {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 16, { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.token]);

  // "Voltar para a área completa".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetViewToken === 0) return;
    const currentAreas = areasRef.current;
    const currentRegions = regionsRef.current;
    if (currentAreas.length > 0 && currentAreas[0].geojson.length > 0) {
      const latlngs = currentAreas[0].geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
      map.flyToBounds(L.latLngBounds(latlngs), { padding: [40, 40], duration: 1 });
      return;
    }
    const regionPoints = currentRegions
      .filter((r) => r.centroid_lat != null && r.centroid_lng != null)
      .map((r) => [r.centroid_lat as number, r.centroid_lng as number] as [number, number]);
    if (regionPoints.length > 0) {
      map.flyToBounds(L.latLngBounds(regionPoints), { padding: [60, 60], duration: 1 });
      return;
    }
    map.flyTo([-22.93, -43.62], 12, { duration: 1 });
  }, [resetViewToken]);

  // Área traçada (referência principal).
  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    areas.forEach((area) => {
      const latlngs = area.geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(latlngs, { color: "#16a34a", weight: 3, dashArray: "8 6", fillOpacity: 0.03 }).addTo(layer);
    });
  }, [areas]);

  // Bairros e sub-bairros — polígono quando existir, ou um rótulo no ponto
  // central (o caso mais comum vindo do Overpass).
  useEffect(() => {
    const layer = regionsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    regions.forEach((region) => {
      const isHighlighted = highlightRegionIds.includes(region.id);
      const isSub = !!region.parent_id;

      if (region.geojson && region.geojson.length >= 3) {
        const latlngs = region.geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
        const polygon = L.polygon(latlngs, {
          color: region.color,
          weight: isHighlighted ? 4 : isSub ? 1.5 : 2,
          dashArray: isSub ? "4 4" : undefined,
          fillColor: region.color,
          fillOpacity: isHighlighted ? 0.45 : 0.15,
        })
          .on("click", () => onRegionClick(region))
          .addTo(layer);
        if (isHighlighted) polygon.bringToFront();
      }

      if (region.centroid_lat != null && region.centroid_lng != null) {
        L.marker([region.centroid_lat, region.centroid_lng], { icon: regionLabelIcon(region, isHighlighted) })
          .on("click", () => onRegionClick(region))
          .addTo(layer);
      }
    });
  }, [regions, highlightRegionIds, onRegionClick]);

  // Ruas — só a partir de RUA_MIN_ZOOM, para não poluir a visão geral.
  // Reagem tanto a mudanças de dados quanto ao evento "zoomend" do mapa.
  useEffect(() => {
    renderUnitsRef.current = () => {
      const layer = unitsLayerRef.current;
      const map = mapRef.current;
      if (!layer || !map) return;
      layer.clearLayers();
      if (map.getZoom() < RUA_MIN_ZOOM) return;
      units.forEach((unit) => {
        const isHighlighted = unit.id === highlightUnitId;
        const marker = L.marker([unit.lat, unit.lng], { icon: unitIcon(isHighlighted) });
        marker.bindTooltip(unit.name, { direction: "top", offset: [0, -6] });
        marker.on("click", () => onUnitClick(unit));
        marker.addTo(layer);
        if (isHighlighted) marker.setZIndexOffset(1000);
      });
    };
    renderUnitsRef.current();
  }, [units, highlightUnitId, onUnitClick]);

  // Linha conectando dois bairros (clique numa distância na aba Distâncias).
  useEffect(() => {
    const layer = connectorLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!connectorLine) return;
    const { a, b, label } = connectorLine;
    L.polyline(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      { color: "#9333ea", weight: 3, dashArray: "6 6" }
    ).addTo(layer);
    if (label) {
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#9333ea;color:white;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.5)">${escapeHtml(
            label
          )}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(layer);
    }
  }, [connectorLine]);

  // Marcador de busca (endereço geocodificado que não bate com nenhum bairro/rua cadastrada).
  useEffect(() => {
    const layer = searchLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!searchMarker) return;
    L.marker([searchMarker.lat, searchMarker.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:#0f172a;border:3px solid #facc15;border-radius:50% 50% 50% 0;width:22px;height:22px;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      }),
    })
      .bindPopup(escapeHtml(searchMarker.label))
      .addTo(layer)
      .openPopup();
  }, [searchMarker]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
