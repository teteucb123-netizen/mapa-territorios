"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet-draw";
import { Area, Region, Unit } from "@/lib/types";

export type MapMode = "normal" | "regions" | "distances" | "routes" | "concentration";
export type DrawTarget = "area" | { regionId: string } | null;

type RouteSequencePoint = { id: string; name: string; lat: number; lng: number };

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

type Props = {
  areas: Area[];
  regions: Region[];
  units: Unit[];
  mode: MapMode;
  drawTarget: DrawTarget;
  onPolygonDrawn: (coords: [number, number][]) => void;
  drawArmedToken: number; // bump this to (re)arm the polygon draw tool
  placingUnit: boolean;
  onMapClickForUnit: (lat: number, lng: number) => void;
  onUnitDragEnd: (unitId: string, lat: number, lng: number) => void;
  onUnitClick: (unit: Unit) => void;
  onRegionClick: (region: Region) => void;
  distanceSelection: Unit[];
  routeSequence: RouteSequencePoint[] | null;
  highlightRegionIds: string[];
  highlightUnitId: string | null;
  connectorLine: ConnectorLine | null;
  flyTo: FlyTarget | null;
  resetViewToken: number; // bump to fit the view back to the full drawn area
  searchMarker: SearchMarker | null;
};

function regionColor(regions: Region[], regionId: string | null): string {
  if (!regionId) return "#64748b";
  return regions.find((r) => r.id === regionId)?.color || "#64748b";
}

function unitIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${selected ? 22 : 16}px;height:${selected ? 22 : 16}px;
      background:${color};border:2px solid white;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.5);
      ${selected ? "outline:3px solid #facc15;" : ""}
    "></div>`,
    iconSize: [selected ? 22 : 16, selected ? 22 : 16],
    iconAnchor: [selected ? 11 : 8, selected ? 11 : 8],
  });
}

export default function MapView({
  areas,
  regions,
  units,
  mode,
  drawTarget,
  onPolygonDrawn,
  drawArmedToken,
  placingUnit,
  onMapClickForUnit,
  onUnitDragEnd,
  onUnitClick,
  onRegionClick,
  distanceSelection,
  routeSequence,
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
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const connectorLayerRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null);

  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onMapClickForUnitRef = useRef(onMapClickForUnit);
  const placingUnitRef = useRef(placingUnit);
  const areasRef = useRef(areas);
  const regionsRef = useRef(regions);

  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
    onMapClickForUnitRef.current = onMapClickForUnit;
    placingUnitRef.current = placingUnit;
    areasRef.current = areas;
    regionsRef.current = regions;
  });

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Default center: Zona Oeste do Rio de Janeiro (Campo Grande / Guaratiba),
    // a sensible starting point until the user draws their own area.
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-22.93, -43.58], 12);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    areaLayerRef.current = L.layerGroup().addTo(map);
    regionsLayerRef.current = L.layerGroup().addTo(map);
    unitsLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    connectorLayerRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);

    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.Polygon }).layer;
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
        (ll) => [Number(ll.lng.toFixed(6)), Number(ll.lat.toFixed(6))] as [number, number]
      );
      onPolygonDrawnRef.current(latlngs);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (placingUnitRef.current) {
        onMapClickForUnitRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Arm/disarm the polygon draw tool when requested.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawArmedToken === 0) return;
    if (drawHandlerRef.current) {
      drawHandlerRef.current.disable();
    }
    const handler = new L.Draw.Polygon(map as unknown as L.DrawMap, {
      shapeOptions: { color: drawTarget === "area" ? "#16a34a" : "#2563eb" },
      showArea: true,
    });
    handler.enable();
    drawHandlerRef.current = handler;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawArmedToken]);

  // Cursor affordance while placing a unit.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = placingUnit ? "crosshair" : "";
    }
  }, [placingUnit]);

  // Fly to a requested target — a searched/selected bairro, sub-bairro, rua
  // or an arbitrary geocoded address. `token` forces the effect to re-run
  // even when clicking the same item twice in a row.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.bounds && flyTo.bounds.length >= 1) {
      const latlngs = flyTo.bounds.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (latlngs.length === 1) {
        map.flyTo(latlngs[0], flyTo.zoom ?? 16, { duration: 1 });
      } else {
        map.flyToBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: flyTo.zoom ?? 16, duration: 1 });
      }
    } else if (typeof flyTo.lat === "number" && typeof flyTo.lng === "number") {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 16, { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.token]);

  // "Voltar para a área completa": fit the view back to the drawn operating
  // area, or fall back to all regions / all units if no area is drawn yet.
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
    map.flyTo([-22.93, -43.58], 12, { duration: 1 });
  }, [resetViewToken]);

  // Redraw area.
  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    areas.forEach((area) => {
      const latlngs = area.geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(latlngs, { color: "#16a34a", weight: 3, dashArray: "8 6", fillOpacity: 0.03 }).addTo(layer);
    });
  }, [areas]);

  // Redraw regions (bairros e sub-bairros).
  useEffect(() => {
    const layer = regionsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (mode !== "regions" && mode !== "normal" && mode !== "concentration" && mode !== "distances") return;
    regions.forEach((region) => {
      if (!region.geojson || region.geojson.length < 3) return;
      const isHighlighted = highlightRegionIds.includes(region.id);
      const isSubBairro = !!region.parent_id;
      const latlngs = region.geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
      const polygon = L.polygon(latlngs, {
        color: region.color,
        weight: isHighlighted ? 4 : isSubBairro ? 1.5 : 2,
        dashArray: isSubBairro ? "4 4" : undefined,
        fillColor: region.color,
        fillOpacity: isHighlighted ? 0.5 : mode === "regions" ? 0.25 : 0.1,
      })
        .bindTooltip(`${region.name}${isSubBairro ? " (sub-bairro)" : ""}`, { permanent: false, direction: "center" })
        .on("click", () => onRegionClick(region))
        .addTo(layer);
      if (isHighlighted) polygon.bringToFront();
    });
  }, [regions, mode, highlightRegionIds, onRegionClick]);

  const handleUnitDragEnd = useCallback(
    (unitId: string, marker: L.Marker) => {
      const pos = marker.getLatLng();
      onUnitDragEnd(unitId, pos.lat, pos.lng);
    },
    [onUnitDragEnd]
  );

  // Redraw units (ruas / pontos).
  useEffect(() => {
    const layer = unitsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    units.forEach((unit) => {
      const isSelected = distanceSelection.some((u) => u.id === unit.id) || unit.id === highlightUnitId;
      const color = regionColor(regions, unit.region_id);
      const marker = L.marker([unit.lat, unit.lng], {
        icon: unitIcon(color, isSelected),
        draggable: true,
      });
      marker.bindPopup(
        `<strong>${escapeHtml(unit.name)}</strong><br/>${escapeHtml(unit.address || "")}<br/><em>${escapeHtml(
          unit.type || ""
        )}</em>`
      );
      marker.on("click", () => onUnitClick(unit));
      marker.on("dragend", () => handleUnitDragEnd(unit.id, marker));
      marker.addTo(layer);
      if (isSelected) marker.setZIndexOffset(1000);
    });
  }, [units, regions, distanceSelection, highlightUnitId, onUnitClick, handleUnitDragEnd]);

  // Draw the currently selected route as connected segments.
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!routeSequence || routeSequence.length < 2) return;
    const latlngs = routeSequence.map((p) => [p.lat, p.lng] as [number, number]);
    L.polyline(latlngs, { color: "#dc2626", weight: 4, dashArray: "2 8" }).addTo(layer);
    routeSequence.forEach((p, idx) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#dc2626;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)">${idx}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      })
        .bindTooltip(p.name)
        .addTo(layer);
    });
  }, [routeSequence]);

  // Draw the "Bairro A ↔ Bairro B" connector line (from clicking a
  // distance-matrix cell).
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
    [a, b].forEach((p) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#9333ea;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .bindTooltip(p.name, { permanent: true, direction: "top" })
        .addTo(layer);
    });
    if (label) {
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#9333ea;color:white;font-size:11px;font-weight:600;padding:2px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.5)">${escapeHtml(
            label
          )}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(layer);
    }
  }, [connectorLine]);

  // Ad-hoc search-result marker (address not matched to an existing bairro/unidade).
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
