"use client";

import { useEffect, useMemo, useState } from "react";
import { Region, Unit } from "@/lib/types";
import { Badge, Card } from "./ui";

const FOCO_PRINCIPAL = "campo grande";

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
  // Campo Grande é o foco principal do sistema: sempre aparece primeiro,
  // independente de ordem alfabética.
  const bairros = useMemo(() => {
    return [...regions.filter((r) => !r.parent_id)].sort((a, b) => {
      const aFoco = a.name.trim().toLowerCase() === FOCO_PRINCIPAL;
      const bFoco = b.name.trim().toLowerCase() === FOCO_PRINCIPAL;
      if (aFoco && !bFoco) return -1;
      if (bFoco && !aFoco) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [regions]);

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
  const [autoOpenedFoco, setAutoOpenedFoco] = useState(false);

  // Campo Grande abre sozinho ao carregar, já mostrando seus sub-bairros —
  // é o foco principal do sistema, não deveria exigir um clique extra.
  useEffect(() => {
    if (autoOpenedFoco) return;
    const foco = regions.find((r) => !r.parent_id && r.name.trim().toLowerCase() === FOCO_PRINCIPAL);
    if (foco) {
      setExpanded((prev) => new Set(prev).add(foco.id));
      setAutoOpenedFoco(true);
    }
  }, [regions, autoOpenedFoco]);

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
    const isFoco = !isSub && region.name.trim().toLowerCase() === FOCO_PRINCIPAL;
    const children = subBairrosByParent.get(region.id) || [];
    const regionUnits = unitsByRegion.get(region.id) || [];
    const hasChildren = children.length > 0 || regionUnits.length > 0;

    // Clicar no nome faz as duas coisas ao mesmo tempo: expande/recolhe a
    // lista de filhos E localiza/destaca no mapa.
    function handleClick() {
      if (hasChildren) toggle(region.id);
      onSelectRegion(region);
    }

    // Preserva a classificação original encontrada no OpenStreetMap em vez
    // de assumir "sub-bairro" para tudo — uma localidade sem status oficial
    // de bairro aparece como "localidade", não como se fosse a mesma coisa.
    const qualifier =
      isSub && region.place_type && region.place_type !== "neighbourhood" && region.place_type !== "quarter"
        ? region.place_type === "hamlet" || region.place_type === "locality"
          ? "localidade"
          : region.place_type
        : null;

    return (
      <div>
        <div
          className={`flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-slate-50 ${
            isSelected ? "bg-teal-50 ring-1 ring-teal-400" : ""
          } ${isFoco ? "bg-amber-50/60" : ""}`}
        >
          {hasChildren ? (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">{isOpen ? "▾" : "▸"}</span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button onClick={handleClick} className="flex flex-1 items-center gap-2 text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
            <span className={`truncate text-sm ${isSub ? "text-slate-600" : "font-medium text-slate-800"}`}>{region.name}</span>
            {qualifier && <span className="shrink-0 text-xs text-slate-400">({qualifier})</span>}
            {isFoco && <Badge color="#d97706">⭐ foco principal</Badge>}
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
            {children.length === 0 && regionUnits.length === 0 && (
              <p className="px-2 py-1 text-xs text-slate-400">Nenhum sub-bairro ou rua identificado aqui ainda.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Bairros e Sub-bairros</h2>
      <p className="mb-4 text-sm text-slate-500">
        <strong>Campo Grande</strong> é o foco principal. Clique em um bairro para abrir seus sub-bairros/localidades, em um
        sub-bairro para ver suas ruas, ou em uma rua para localizar no mapa.
      </p>
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
    </div>
  );
}
