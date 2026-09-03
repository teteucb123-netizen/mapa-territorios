"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet-draw";
import { Area, Region, Unit } from "@/lib/types";

export type MapMode = "normal" | "regions" | "distances" | "routes" | "concentration";
export type DrawTarget = "area" | { regionId: string } | null;

type RouteSequencePoint = { id: string; name: string; lat: number; lng: number };

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
  distanceSelection: Unit[];
  routeSequence: RouteSequencePoint[] | null;
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
  distanceSelection,
  routeSequence,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const regionsLayerRef = useRef<L.LayerGroup | null>(null);
  const unitsLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null);

  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onMapClickForUnitRef = useRef(onMapClickForUnit);
  const placingUnitRef = useRef(placingUnit);

  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
    onMapClickForUnitRef.current = onMapClickForUnit;
    placingUnitRef.current = placingUnit;
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

  // Redraw regions.
  useEffect(() => {
    const layer = regionsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (mode !== "regions" && mode !== "normal" && mode !== "concentration") return;
    regions.forEach((region) => {
      if (!region.geojson || region.geojson.length < 3) return;
      const latlngs = region.geojson.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(latlngs, {
        color: region.color,
        weight: 2,
        fillColor: region.color,
        fillOpacity: mode === "regions" ? 0.25 : 0.1,
      })
        .bindTooltip(region.name, { permanent: false, direction: "center" })
        .addTo(layer);
    });
  }, [regions, mode]);

  const handleUnitDragEnd = useCallback(
    (unitId: string, marker: L.Marker) => {
      const pos = marker.getLatLng();
      onUnitDragEnd(unitId, pos.lat, pos.lng);
    },
    [onUnitDragEnd]
  );

  // Redraw units.
  useEffect(() => {
    const layer = unitsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    units.forEach((unit) => {
      const isSelected = distanceSelection.some((u) => u.id === unit.id);
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
    });
  }, [units, regions, distanceSelection, onUnitClick, handleUnitDragEnd]);

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

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
