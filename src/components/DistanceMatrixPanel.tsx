"use client";

import { useEffect, useState } from "react";
import { Region } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button, Card, Select } from "./ui";

type MatrixData = {
  labels: string[];
  ids: string[];
  colors?: string[];
  km: number[][];
  minutes: number[][];
  estimated: boolean;
};

export default function DistanceMatrixPanel({
  regions,
  onCellClick,
}: {
  regions: Region[];
  onCellClick?: (originId: string, destId: string, km: number, minutes: number) => void;
}) {
  const [type, setType] = useState<"units" | "regions">("regions");
  const [regionFilter, setRegionFilter] = useState("");
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.distanceMatrix(type, regionFilter || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao calcular a matriz.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch matrix when filters change
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, regionFilter]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Matriz de distâncias</h2>
        <div className="flex items-center gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value as "units" | "regions")} className="w-52">
            <option value="regions">Entre regiões (centro a centro)</option>
            <option value="units">Entre unidades</option>
          </Select>
          {type === "units" && (
            <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="w-52">
              <option value="">Todas as unidades</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          )}
          <Button variant="secondary" onClick={load} disabled={loading}>{loading ? "Calculando…" : "Recalcular"}</Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      {data && data.estimated && (
        <p className="mb-3 text-xs text-amber-600">
          Distâncias por estrada indisponíveis no momento — valores estimados a partir da distância em linha reta.
        </p>
      )}

      {data && data.labels.length === 0 && (
        <p className="text-sm text-slate-400">
          {type === "regions"
            ? "Cadastre ao menos duas regiões com limite desenhado no mapa para calcular a matriz."
            : "Cadastre ao menos duas unidades para calcular a matriz."}
        </p>
      )}

      {data && data.labels.length > 0 && (
        <Card className="overflow-auto p-0">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">Origem \ Destino</th>
                {data.labels.map((label, i) => (
                  <th key={i} className="whitespace-nowrap border-l border-slate-100 px-3 py-2 text-left font-medium text-slate-600">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.labels.map((rowLabel, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-700">{rowLabel}</td>
                  {data.labels.map((_, j) => (
                    <td key={j} className="whitespace-nowrap border-l border-slate-100 px-3 py-2 text-slate-600">
                      {i === j ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <button
                          type="button"
                          disabled={type !== "regions" || !onCellClick}
                          onClick={() => onCellClick?.(data.ids[i], data.ids[j], data.km[i][j], data.minutes[i][j])}
                          className={type === "regions" ? "rounded px-1 py-0.5 hover:bg-teal-50 hover:text-teal-700" : ""}
                          title={type === "regions" ? "Ver no mapa" : undefined}
                        >
                          {data.km[i][j]} km
                          <span className="ml-1 text-xs text-slate-400">· {data.minutes[i][j]} min</span>
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
