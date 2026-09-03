"use client";

import { useState } from "react";
import { Region, Team, Unit } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, Select, Textarea, Badge } from "./ui";

const COLOR_PRESETS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];

const emptyForm = { name: "", code: "", color: COLOR_PRESETS[0], responsible: "", team_id: "", notes: "", parent_id: "" };

export default function RegionsPanel({
  regions,
  teams,
  units,
  onChange,
  onRequestDraw,
}: {
  regions: Region[];
  teams: Team[];
  units: Unit[];
  onChange: () => void;
  onRequestDraw: (regionId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(region: Region) {
    setEditingId(region.id);
    setForm({
      name: region.name,
      code: region.code || "",
      color: region.color,
      responsible: region.responsible || "",
      team_id: region.team_id || "",
      notes: region.notes || "",
      parent_id: region.parent_id || "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Nome da região é obrigatório.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      color: form.color,
      responsible: form.responsible.trim() || null,
      team_id: form.team_id || null,
      notes: form.notes.trim() || null,
      parent_id: form.parent_id || null,
    };
    try {
      if (editingId) await api.regions.update(editingId, payload);
      else await api.regions.create(payload);
      reset();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta região? As unidades vinculadas ficarão sem região.")) return;
    await api.regions.remove(id);
    if (editingId === id) reset();
    onChange();
  }

  function unitCount(regionId: string) {
    return units.filter((u) => u.region_id === regionId).length;
  }

  const sortedRegions = [...regions].sort((a, b) => {
    // Bairros first (alphabetical), each followed immediately by its sub-bairros.
    const aTop = a.parent_id || a.id;
    const bTop = b.parent_id || b.id;
    if (aTop !== bTop) {
      const aName = regions.find((r) => r.id === aTop)?.name || "";
      const bName = regions.find((r) => r.id === bTop)?.name || "";
      return aName.localeCompare(bName);
    }
    if (!a.parent_id && b.parent_id) return -1;
    if (a.parent_id && !b.parent_id) return 1;
    return a.name.localeCompare(b.name);
  });

  // Valid "bairro pai" choices: top-level regions only, excluding the region
  // being edited and any region that already has sub-bairros of its own
  // (keeps the hierarchy to exactly two levels).
  const parentOptions = regions.filter(
    (r) => !r.parent_id && r.id !== editingId && !regions.some((c) => c.parent_id === r.id && c.id !== editingId)
  );

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Regiões ({regions.length})</h2>
        <div className="space-y-2">
          {regions.length === 0 && <p className="text-sm text-slate-400">Nenhuma região cadastrada ainda.</p>}
          {sortedRegions.map((region) => (
            <Card
              key={region.id}
              className={`flex items-center justify-between px-4 py-3 ${region.parent_id ? "ml-6 border-dashed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    {region.name}
                    {region.code && <Badge>{region.code}</Badge>}
                    {region.parent_id ? (
                      <Badge>sub-bairro de {regions.find((r) => r.id === region.parent_id)?.name}</Badge>
                    ) : (
                      <Badge color="#0f766e">bairro</Badge>
                    )}
                    {!region.geojson && <Badge color="#d97706">sem limite desenhado</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {unitCount(region.id)} unidade(s)
                    {region.responsible && <> · Responsável: {region.responsible}</>}
                    {region.team_id && <> · Equipe: {teams.find((t) => t.id === region.team_id)?.name}</>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => onRequestDraw(region.id)}>
                  {region.geojson ? "Redesenhar limite" : "Desenhar limite"}
                </Button>
                <Button variant="ghost" onClick={() => startEdit(region)}>Editar</Button>
                <Button variant="danger" onClick={() => remove(region.id)}>Excluir</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="h-fit p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{editingId ? "Editar região" : "Nova região"}</h3>
        <div className="space-y-3">
          <Field label="Nome *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Zona Norte" />
          </Field>
          <Field label="Código">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="REG-01" />
          </Field>
          <Field label="Bairro pai (deixe vazio para criar um Bairro de nível 1)">
            <Select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
              <option value="">— é um bairro (nível 1) —</option>
              {parentOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
            {form.parent_id && <p className="mt-1 text-xs text-slate-400">Isso cria um sub-bairro dentro de {regions.find((r) => r.id === form.parent_id)?.name}.</p>}
          </Field>
          <Field label="Cor">
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="h-7 w-7 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: form.color === c ? "#0f172a" : "transparent" }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
          <Field label="Responsável">
            <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </Field>
          <Field label="Equipe">
            <Select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
              <option value="">— nenhuma —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Observações">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy}>{editingId ? "Salvar alterações" : "Criar região"}</Button>
            {editingId && <Button variant="secondary" onClick={reset}>Cancelar</Button>}
          </div>
          {!editingId && (
            <p className="pt-1 text-xs text-slate-400">
              Depois de criar, use &quot;Desenhar limite&quot; para marcar a área da região no mapa.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
