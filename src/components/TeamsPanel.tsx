"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, Textarea } from "./ui";

const emptyForm = { name: "", responsible: "", membersText: "", vehicle: "", notes: "" };

export default function TeamsPanel({ teams, onChange }: { teams: Team[]; onChange: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(team: Team) {
    setEditingId(team.id);
    setForm({
      name: team.name,
      responsible: team.responsible || "",
      membersText: team.members.join(", "),
      vehicle: team.vehicle || "",
      notes: team.notes || "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Nome da equipe é obrigatório.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      responsible: form.responsible.trim() || null,
      members: form.membersText.split(",").map((s) => s.trim()).filter(Boolean),
      vehicle: form.vehicle.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editingId) await api.teams.update(editingId, payload);
      else await api.teams.create(payload);
      reset();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta equipe? Regiões e unidades vinculadas ficarão sem equipe.")) return;
    await api.teams.remove(id);
    if (editingId === id) reset();
    onChange();
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Equipes ({teams.length})</h2>
        <div className="space-y-2">
          {teams.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma equipe cadastrada ainda.</p>
          )}
          {teams.map((team) => (
            <Card key={team.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">{team.name}</div>
                <div className="text-xs text-slate-500">
                  {team.responsible && <>Responsável: {team.responsible} · </>}
                  {team.members.length > 0 ? `${team.members.length} membro(s)` : "sem membros cadastrados"}
                  {team.vehicle && <> · Veículo: {team.vehicle}</>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(team)}>Editar</Button>
                <Button variant="danger" onClick={() => remove(team.id)}>Excluir</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="h-fit p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          {editingId ? "Editar equipe" : "Nova equipe"}
        </h3>
        <div className="space-y-3">
          <Field label="Nome *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Equipe Zona Norte" />
          </Field>
          <Field label="Responsável">
            <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </Field>
          <Field label="Membros (separados por vírgula)">
            <Input value={form.membersText} onChange={(e) => setForm({ ...form, membersText: e.target.value })} placeholder="João, Maria, Pedro" />
          </Field>
          <Field label="Veículo">
            <Input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="Van placa ABC-1234" />
          </Field>
          <Field label="Observações">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy}>{editingId ? "Salvar alterações" : "Criar equipe"}</Button>
            {editingId && <Button variant="secondary" onClick={reset}>Cancelar</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
