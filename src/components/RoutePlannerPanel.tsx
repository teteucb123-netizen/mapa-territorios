"use client";

import { useEffect, useState } from "react";
import { RouteRecord, Unit } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Select } from "./ui";

type Sequence = { id: string; name: string; lat: number; lng: number }[];

export default function RoutePlannerPanel({
  units,
  onViewOnMap,
}: {
  units: Unit[];
  onViewOnMap: (sequence: Sequence) => void;
}) {
  const [originId, setOriginId] = useState("");
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ km: number; min: number; sequence: Sequence; estimated: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<RouteRecord[]>([]);

  async function loadSaved() {
    setSaved(await api.routePlan.list());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    loadSaved();
  }, []);

  function toggleStop(id: string) {
    setStopIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function plan() {
    if (!originId) {
      setError("Selecione a unidade de origem (ex.: sede da empresa).");
      return;
    }
    if (stopIds.length === 0) {
      setError("Selecione ao menos uma unidade de destino.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.routePlan.create({ origin_unit_id: originId, stop_unit_ids: stopIds });
      setResult({ km: res.total_km || 0, min: res.total_min || 0, sequence: res.sequence, estimated: res.estimated });
      loadSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao planejar rota.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(id: string) {
    await api.routePlan.remove(id);
    loadSaved();
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_380px]">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Rotas salvas ({saved.length})</h2>
        <div className="space-y-2">
          {saved.length === 0 && <p className="text-sm text-slate-400">Nenhuma rota planejada ainda.</p>}
          {saved.map((r) => (
            <Card key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-500">
                  {r.stop_unit_ids.length} parada(s)
                  {r.total_km != null && <> · {r.total_km} km</>}
                  {r.total_min != null && <> · {Math.round(r.total_min)} min</>}
                </div>
              </div>
              <Button variant="danger" onClick={() => removeSaved(r.id)}>Excluir</Button>
            </Card>
          ))}
        </div>

        {result && (
          <Card className="mt-6 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Sequência sugerida</h3>
              <Button variant="secondary" onClick={() => onViewOnMap(result.sequence)}>Ver no mapa</Button>
            </div>
            {result.estimated && (
              <p className="mb-2 text-xs text-amber-600">Rota otimizada indisponível no momento — sequência estimada por proximidade.</p>
            )}
            <ol className="space-y-1 text-sm text-slate-700">
              {result.sequence.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">{i}</span>
                  {s.name}
                </li>
              ))}
            </ol>
            <div className="mt-3 text-sm font-medium text-slate-800">
              Total: {result.km.toFixed(1)} km · {Math.round(result.min)} min · {stopIds.length} parada(s)
            </div>
          </Card>
        )}
      </div>

      <Card className="h-fit p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Planejar nova rota</h3>
        <div className="space-y-3">
          <Field label="Origem (ex.: sede) *">
            <Select value={originId} onChange={(e) => setOriginId(e.target.value)}>
              <option value="">— selecione —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Destinos (${stopIds.length} selecionado${stopIds.length === 1 ? "" : "s"})`}>
            <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
              {units.filter((u) => u.id !== originId).map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={stopIds.includes(u.id)} onChange={() => toggleStop(u.id)} />
                  {u.name}
                </label>
              ))}
              {units.length === 0 && <p className="p-2 text-xs text-slate-400">Cadastre unidades primeiro.</p>}
            </div>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={plan} disabled={busy} className="w-full">{busy ? "Calculando…" : "Calcular melhor sequência"}</Button>
        </div>
      </Card>
    </div>
  );
}
