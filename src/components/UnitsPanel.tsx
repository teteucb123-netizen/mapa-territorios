"use client";

import { useEffect, useMemo, useState } from "react";
import { Region, Team, Unit } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, Select, Textarea, Badge } from "./ui";

const UNIT_TYPES = ["Loja", "Depósito", "Escritório", "Ponto de coleta", "Cliente", "Outro"];

const emptyForm = {
  name: "",
  code: "",
  address: "",
  cep: "",
  neighborhood: "",
  city: "",
  state: "",
  lat: "",
  lng: "",
  region_id: "",
  responsible: "",
  team_id: "",
  type: "",
  phone: "",
  notes: "",
};

export default function UnitsPanel({
  units,
  regions,
  teams,
  onChange,
  pendingCoords,
  onConsumePendingCoords,
  focusUnitId,
}: {
  units: Unit[];
  regions: Region[];
  teams: Team[];
  onChange: () => void;
  pendingCoords: { lat: number; lng: number } | null;
  onConsumePendingCoords: () => void;
  focusUnitId: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCity, setFilterCity] = useState("");

  // A pin dropped on the map (via "Adicionar unidade no mapa") opens this
  // form pre-filled with the clicked coordinates.
  useEffect(() => {
    if (pendingCoords) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing an external map-click event into form state
      setEditingId(null);
      setForm({ ...emptyForm, lat: String(pendingCoords.lat.toFixed(6)), lng: String(pendingCoords.lng.toFixed(6)) });
      onConsumePendingCoords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCoords]);

  function startEdit(unit: Unit) {
    setEditingId(unit.id);
    setForm({
      name: unit.name,
      code: unit.code || "",
      address: unit.address || "",
      cep: unit.cep || "",
      neighborhood: unit.neighborhood || "",
      city: unit.city || "",
      state: unit.state || "",
      lat: String(unit.lat),
      lng: String(unit.lng),
      region_id: unit.region_id || "",
      responsible: unit.responsible || "",
      team_id: unit.team_id || "",
      type: unit.type || "",
      phone: unit.phone || "",
      notes: unit.notes || "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function geocode() {
    const q = [form.address, form.neighborhood, form.city, form.state].filter(Boolean).join(", ");
    if (!q.trim()) {
      setError("Preencha ao menos o endereço para localizar no mapa.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const result = await api.geocode(q);
      setForm((f) => ({ ...f, lat: String(result.lat.toFixed(6)), lng: String(result.lng.toFixed(6)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível localizar o endereço.");
    } finally {
      setGeocoding(false);
    }
  }

  async function save() {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim()) {
      setError("Nome da unidade é obrigatório.");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Informe a localização: geocodifique o endereço ou clique no mapa (\"Adicionar unidade no mapa\").");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      address: form.address.trim() || null,
      cep: form.cep.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      lat,
      lng,
      region_id: form.region_id || null,
      responsible: form.responsible.trim() || null,
      team_id: form.team_id || null,
      type: form.type || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editingId) await api.units.update(editingId, payload);
      else await api.units.create(payload);
      reset();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta unidade?")) return;
    await api.units.remove(id);
    if (editingId === id) reset();
    onChange();
  }

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (filterRegion && u.region_id !== filterRegion) return false;
      if (filterCity && !(u.city || "").toLowerCase().includes(filterCity.toLowerCase())) return false;
      return true;
    });
  }, [units, filterRegion, filterCity]);

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Unidades ({filtered.length}/{units.length})</h2>
          <div className="flex gap-2">
            <Select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="w-44">
              <option value="">Todas as regiões</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
            <Input placeholder="Filtrar por cidade" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-44" />
          </div>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-slate-400">Nenhuma unidade encontrada.</p>}
          {filtered.map((unit) => {
            const region = regions.find((r) => r.id === unit.region_id);
            return (
              <Card
                key={unit.id}
                className={`flex items-center justify-between px-4 py-3 ${focusUnitId === unit.id ? "ring-2 ring-teal-500" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    {unit.name}
                    {unit.code && <Badge>{unit.code}</Badge>}
                    {region && <Badge color={region.color}>{region.name}</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {unit.address || "sem endereço"}{unit.city && `, ${unit.city}`}
                    {unit.type && <> · {unit.type}</>}
                    {unit.team_id && <> · Equipe: {teams.find((t) => t.id === unit.team_id)?.name}</>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" onClick={() => startEdit(unit)}>Editar</Button>
                  <Button variant="danger" onClick={() => remove(unit.id)}>Excluir</Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="h-fit p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{editingId ? "Editar unidade" : "Nova unidade"}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nome *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Código">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
          </div>
          <Field label="Endereço">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bairro">
              <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </Field>
            <Field label="CEP">
              <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
            </Field>
            <Field label="Cidade">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Estado">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="RJ" />
            </Field>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Latitude">
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </Field>
          </div>
          <Button type="button" variant="secondary" onClick={geocode} disabled={geocoding} className="w-full">
            {geocoding ? "Localizando…" : "Localizar endereço no mapa"}
          </Button>
          <p className="text-xs text-slate-400">
            Ou vá até a aba Mapa e use &quot;Adicionar unidade no mapa&quot; para marcar o ponto clicando diretamente.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Região">
              <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                <option value="">— nenhuma —</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">— nenhum —</option>
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Equipe">
              <Select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                <option value="">— nenhuma —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Responsável">
            <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </Field>
          <Field label="Observações">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy}>{editingId ? "Salvar alterações" : "Criar unidade"}</Button>
            {editingId && <Button variant="secondary" onClick={reset}>Cancelar</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
