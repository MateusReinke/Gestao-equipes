'use client';

import { FormEvent, useState } from 'react';
import { AttendanceMode, Client, createId, useOperationalData } from '@/lib/operations-store';

const attendanceModes: AttendanceMode[] = ['Remoto', 'Presencial', 'Híbrido'];

const defaultForm: Omit<Client, 'id'> = {
  nome: '',
  contato: '',
  responsavel: '',
  modeloAtendimento: 'Remoto',
  observacoes: ''
};

export function ClientManagementPanel() {
  const { data, setData } = useOperationalData();
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editingId) {
      setData((prev) => ({
        ...prev,
        clients: prev.clients.map((item) => (item.id === editingId ? { ...item, ...form, nome: form.nome.trim() } : item))
      }));
      resetForm();
      return;
    }

    setData((prev) => ({
      ...prev,
      clients: [...prev.clients, { ...form, id: createId('client'), nome: form.nome.trim() }]
    }));
    resetForm();
  }

  function removeClient(clientId: string) {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.filter((client) => client.id !== clientId),
      collaborators: prev.collaborators.map((collaborator) => ({
        ...collaborator,
        clientesIds: collaborator.clientesIds.filter((id) => id !== clientId)
      }))
    }));

    if (editingId === clientId) resetForm();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Cadastro de clientes e modelo de atendimento</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={saveClient}>
          <input required className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nome do cliente" value={form.nome} onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))} />
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Contato" value={form.contato} onChange={(event) => setForm((prev) => ({ ...prev, contato: event.target.value }))} />
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Responsável" value={form.responsavel} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: event.target.value }))} />
          <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={form.modeloAtendimento} onChange={(event) => setForm((prev) => ({ ...prev, modeloAtendimento: event.target.value as AttendanceMode }))}>
            {attendanceModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <textarea className="md:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Observações" value={form.observacoes} onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))} />
          <div className="md:col-span-2 flex gap-2">
            <button className="rounded bg-sky-600 px-3 py-2 font-medium" type="submit">{editingId ? 'Atualizar cliente' : 'Adicionar cliente'}</button>
            {editingId && <button className="rounded border border-slate-700 px-3 py-2" type="button" onClick={resetForm}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="p-2">Cliente</th>
              <th className="p-2">Contato / Responsável</th>
              <th className="p-2">Atendimento</th>
              <th className="p-2">Quem atende</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.clients.map((client) => {
              const atendentes = data.collaborators.filter((collaborator) => collaborator.clientesIds.includes(client.id));
              return (
                <tr key={client.id} className="border-b border-slate-900 align-top">
                  <td className="p-2">{client.nome}<p className="text-slate-400">{client.observacoes || 'Sem observações'}</p></td>
                  <td className="p-2">{client.contato || '-'}<p className="text-slate-400">{client.responsavel || 'Sem responsável'}</p></td>
                  <td className="p-2">{client.modeloAtendimento}</td>
                  <td className="p-2">{atendentes.length ? atendentes.map((item) => item.nome).join(', ') : 'Sem atendentes vinculados'}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button type="button" className="rounded border border-amber-500 px-2 py-1" onClick={() => { setEditingId(client.id); setForm({ nome: client.nome, contato: client.contato, responsavel: client.responsavel, modeloAtendimento: client.modeloAtendimento, observacoes: client.observacoes }); }}>Editar</button>
                      <button type="button" className="rounded border border-rose-500 px-2 py-1" onClick={() => removeClient(client.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
