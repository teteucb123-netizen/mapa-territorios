"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card } from "./ui";

type DashboardData = Awaited<ReturnType<typeof api.dashboard>>;

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export default function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-slate-400">Carregando…</div>;

  const maxCount = Math.max(1, ...data.regionUnitCounts.map((r) => r.unit_count));

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Dashboard</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Regiões" value={data.totalRegions} />
        <StatCard label="Unidades" value={data.totalUnits} />
        <StatCard label="Equipes" value={data.totalTeams} />
        <StatCard
          label="Distância média entre unidades"
          value={data.avgUnitDistanceKm != null ? `${data.avgUnitDistanceKm} km` : "—"}
        />
        <StatCard
          label="Região com mais unidades"
          value={data.topRegion ? data.topRegion.name : "—"}
          sub={data.topRegion ? `${data.topRegion.unit_count} unidade(s)` : undefined}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Unidades por região</h3>
          {data.regionUnitCounts.length === 0 && <p className="text-sm text-slate-400">Sem dados ainda.</p>}
          <div className="space-y-2">
            {data.regionUnitCounts.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-sm text-slate-600">{r.name}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full"
                    style={{ width: `${(r.unit_count / maxCount) * 100}%`, backgroundColor: r.color }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-slate-500">{r.unit_count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Proximidade entre regiões</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-800">Mais próximas: </span>
              {data.nearestRegionPair
                ? `${data.nearestRegionPair.a} ↔ ${data.nearestRegionPair.b} (${data.nearestRegionPair.km} km)`
                : "cadastre ao menos 2 regiões com limite desenhado"}
            </div>
            <div>
              <span className="font-medium text-slate-800">Mais distantes: </span>
              {data.farthestRegionPair
                ? `${data.farthestRegionPair.a} ↔ ${data.farthestRegionPair.b} (${data.farthestRegionPair.km} km)`
                : "cadastre ao menos 2 regiões com limite desenhado"}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
