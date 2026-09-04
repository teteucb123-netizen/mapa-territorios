"use client";

import { useEffect, useMemo, useState } from "react";
import { BairroDistance, Region } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Card, Select } from "./ui";

type View = "lista" | "por-bairro" | "matriz";

export default function DistanciasPanel({
  regions,
  onSelectPair,
}: {
  regions: Region[];
  onSelectPair: (originId: string, destId: string, km: number) => void;
}) {
  const bairros = useMemo(() => regions.filter((r) => !r.parent_id).sort((a, b) => a.name.localeCompare(b.name)), [regions]);

  const [distances, setDistances] = useState<BairroDistance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("lista");
  const [byBairroId, setByBairroId] = useState("");
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");

  useEffect(() => {
    api.bairroDistances
      .list()
      .then(setDistances)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar distâncias."));
  }, []);

  const lookup = useMemo(() => {
    const map = new Map<string, BairroDistance>();
    (distances || []).forEach((d) => map.set(`${d.origin_id}:${d.dest_id}`, d));
    return map;
  }, [distances]);

  const quickResult = originId && destId ? lookup.get(`${originId}:${destId}`) : null;

  // Only "A → B" (not the reverse "B → A") is needed for the list view —
  // the underlying data has both directions stored, but they're the same
  // road/straight-line relationship shown twice.
  const uniquePairs = useMemo(() => {
    if (!distances) return [];
    const seen = new Set<string>();
    const pairs: BairroDistance[] = [];
    for (const d of distances) {
      const key = [d.origin_id, d.dest_id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(d);
    }
    return pairs.sort((a, b) => a.km - b.km);
  }, [distances]);

  const perBairro = useMemo(() => {
    if (!byBairroId || !distances) return [];
    return distances.filter((d) => d.origin_id === byBairroId).sort((a, b) => a.km - b.km);
  }, [byBairroId, distances]);

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!distances) return <div className="p-6 text-sm text-slate-400">Carregando distâncias…</div>;

  if (bairros.length < 2) {
    return (
      <div className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Distâncias entre Bairros</h2>
        <p className="text-sm text-slate-500">
          É preciso ao menos 2 bairros identificados para calcular e mostrar distâncias. Use o botão &quot;Identificar
          bairros e ruas&quot; na aba Mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Distâncias entre Bairros</h2>

      {distances.some((d) => d.estimated) && (
        <p className="mb-3 text-xs text-amber-600">
          Algumas distâncias foram estimadas em linha reta (serviço de rota indisponível no momento em que foram calculadas).
        </p>
      )}

      <Card className="mb-4 p-4">
        <span className="mb-2 block text-xs font-medium text-slate-500">Consulta rápida</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={originId} onChange={(e) => setOriginId(e.target.value)} className="w-48">
            <option value="">Bairro de origem</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <span className="text-slate-400">→</span>
          <Select value={destId} onChange={(e) => setDestId(e.target.value)} className="w-48">
            <option value="">Bairro de destino</option>
            {bairros.filter((b) => b.id !== originId).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          {quickResult && (
            <button
              onClick={() => onSelectPair(originId, destId, quickResult.km)}
              className="rounded-md bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100"
            >
              {quickResult.km} km · {quickResult.minutes ? `${Math.round(quickResult.minutes)} min` : "—"} · ver no mapa
            </button>
          )}
          {originId && destId && !quickResult && (
            <span className="text-sm text-slate-400">distância não disponível entre esses dois</span>
          )}
        </div>
      </Card>

      <div className="mb-4 flex gap-1">
        {([
          ["lista", "Lista"],
          ["por-bairro", "Por bairro"],
          ["matriz", "Matriz completa"],
        ] as [View, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === id ? "bg-teal-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "lista" && (
        <Card className="overflow-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">Bairro de origem</th>
                <th className="px-3 py-2 font-medium">Bairro de destino</th>
                <th className="px-3 py-2 text-right font-medium">Distância</th>
              </tr>
            </thead>
            <tbody>
              {uniquePairs.map((d) => (
                <tr
                  key={`${d.origin_id}-${d.dest_id}`}
                  className="cursor-pointer border-t border-slate-100 hover:bg-teal-50"
                  onClick={() => onSelectPair(d.origin_id, d.dest_id, d.km)}
                >
                  <td className="px-3 py-2">{d.origin_name}</td>
                  <td className="px-3 py-2">{d.dest_name}</td>
                  <td className="px-3 py-2 text-right font-medium">{d.km} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {view === "por-bairro" && (
        <div>
          <Select value={byBairroId} onChange={(e) => setByBairroId(e.target.value)} className="mb-3 w-56">
            <option value="">Selecione um bairro</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          {byBairroId && (
            <Card className="p-2">
              <ol className="divide-y divide-slate-100">
                {perBairro.map((d, i) => (
                  <li
                    key={d.dest_id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-teal-50"
                    onClick={() => onSelectPair(d.origin_id, d.dest_id, d.km)}
                  >
                    <span className="w-5 text-xs text-slate-400">{i + 1}.</span>
                    <span className="flex-1 text-sm text-slate-700">{d.dest_name}</span>
                    <span className="text-sm font-medium text-slate-800">{d.km} km</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      {view === "matriz" && (
        <Card className="overflow-auto p-0">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">Bairro</th>
                {bairros.map((b) => (
                  <th key={b.id} className="whitespace-nowrap border-l border-slate-100 px-3 py-2 text-left font-medium text-slate-600">
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bairros.map((rowB) => (
                <tr key={rowB.id} className="border-t border-slate-100">
                  <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-700">{rowB.name}</td>
                  {bairros.map((colB) => {
                    if (rowB.id === colB.id) return <td key={colB.id} className="border-l border-slate-100 px-3 py-2 text-slate-300">—</td>;
                    const d = lookup.get(`${rowB.id}:${colB.id}`);
                    return (
                      <td key={colB.id} className="whitespace-nowrap border-l border-slate-100 px-3 py-2">
                        {d ? (
                          <button
                            onClick={() => onSelectPair(rowB.id, colB.id, d.km)}
                            className="rounded px-1 py-0.5 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                          >
                            {d.km} km
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
