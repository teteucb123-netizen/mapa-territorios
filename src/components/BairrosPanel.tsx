"use client";

import { useEffect, useMemo, useState } from "react";
import { Region, Unit } from "@/lib/types";
import { Card } from "./ui";

export default function BairrosPanel({
  regions,
  units,
  onSelectRegion,
  onSelectUnit,
  selectedRegionId,
  selectedUnitId,
}: {
  regions: Region[];
  units: Unit[];
  onSelectRegion: (region: Region) => void;
  onSelectUnit: (unit: Unit) => void;
  selectedRegionId: string | null;
  selectedUnitId: string | null;
}) {
  const bairros = useMemo(() => regions.filter((r) => !r.parent_id).sort((a, b) => a.name.localeCompare(b.name)), [regions]);
  const subBairrosByParent = useMemo(() => {
    const map = new Map<string, Region[]>();
    regions
      .filter((r) => r.parent_id)
      .forEach((r) => {
        const list = map.get(r.parent_id as string) || [];
        list.push(r);
        map.set(r.parent_id as string, list);
      });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [regions]);
  const unitsByRegion = useMemo(() => {
    const map = new Map<string, Unit[]>();
    units.forEach((u) => {
      if (!u.region_id) return;
      const list = map.get(u.region_id) || [];
      list.push(u);
      map.set(u.region_id, list);
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [units]);
  const unitsWithoutRegion = useMemo(() => units.filter((u) => !u.region_id).sort((a, b) => a.name.localeCompare(b.name)), [units]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand the ancestors of whatever got selected (from a map click),
  // so the tree opens itself to reveal the highlighted item.
  useEffect(() => {
    if (selectedRegionId) {
      const region = regions.find((r) => r.id === selectedRegionId);
      if (region?.parent_id) {
        setExpanded((prev) => new Set(prev).add(region.parent_id as string));
      }
    }
    if (selectedUnitId) {
      const unit = units.find((u) => u.id === selectedUnitId);
      if (unit?.region_id) {
        setExpanded((prev) => {
          const next = new Set(prev).add(unit.region_id as string);
          const region = regions.find((r) => r.id === unit.region_id);
          if (region?.parent_id) next.add(region.parent_id as string);
          return next;
        });
      }
    }
  }, [selectedRegionId, selectedUnitId, regions, units]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function UnitRow({ unit }: { unit: Unit }) {
    const isSelected = unit.id === selectedUnitId;
    return (
      <button
        onClick={() => onSelectUnit(unit)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50 ${
          isSelected ? "bg-teal-50 ring-1 ring-teal-400" : ""
        }`}
      >
        <span className="text-slate-300">•</span>
        <span className="truncate text-slate-700">{unit.name}</span>
        {unit.type && <span className="ml-auto shrink-0 text-xs text-slate-400">{unit.type}</span>}
      </button>
    );
  }

  function RegionRow({ region, isSub }: { region: Region; isSub: boolean }) {
    const isSelected = region.id === selectedRegionId;
    const isOpen = expanded.has(region.id);
    const children = subBairrosByParent.get(region.id) || [];
    const regionUnits = unitsByRegion.get(region.id) || [];
    const hasChildren = children.length > 0 || regionUnits.length > 0;

    return (
      <div>
        <div
          className={`flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-slate-50 ${
            isSelected ? "bg-teal-50 ring-1 ring-teal-400" : ""
          }`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggle(region.id)}
              className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400"
              aria-label={isOpen ? "Recolher" : "Expandir"}
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button onClick={() => onSelectRegion(region)} className="flex flex-1 items-center gap-2 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
            <span className={`truncate text-sm ${isSub ? "text-slate-600" : "font-medium text-slate-800"}`}>{region.name}</span>
          </button>
        </div>
        {isOpen && (
          <div className="ml-5 space-y-0.5 border-l border-slate-100 pl-2">
            {children.map((sub) => (
              <RegionRow key={sub.id} region={sub} isSub />
            ))}
            {regionUnits.map((u) => (
              <UnitRow key={u.id} unit={u} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-2">
      {bairros.length === 0 && (
        <p className="p-3 text-sm text-slate-400">
          Nenhum bairro identificado ainda. Use o botão &quot;Identificar bairros e ruas&quot; para consultar dados
          geográficos reais dentro da área traçada.
        </p>
      )}
      <div className="space-y-0.5">
        {bairros.map((b) => (
          <RegionRow key={b.id} region={b} isSub={false} />
        ))}
      </div>
      {unitsWithoutRegion.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">Sem bairro</div>
          <div className="space-y-0.5">
            {unitsWithoutRegion.map((u) => (
              <UnitRow key={u.id} unit={u} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
