'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  Collaborator,
  Client,
  ShiftType,
  Team,
  WorkModel,
  createId,
  useOperationalData
} from '@/lib/operations-store';

type CollaboratorForm = Omit<Collaborator, 'id'>;
type TeamForm = Omit<Team, 'id'>;

const shiftOptions: ShiftType[] = ['Manhã', 'Tarde', 'Noite', 'Plantão'];
const workModels: WorkModel[] = ['Remoto', 'Híbrido', 'Presencial'];

const defaultTeamForm: TeamForm = { nome: '', descricao: '' };

function buildDefaultCollaborator(teams: Team[]): CollaboratorForm {
  return {
    nome: '',
    email: '',
    telefone: '',
    cargo: '',
    equipeId: teams[0]?.id ?? '',
    gestor: '',
    dataNascimento: '',
    dataContratacao: '',
    modeloTrabalho: 'Híbrido',
    cargaHorariaSemanal: 40,
    fazPlantao: false,
    sobreAviso: false,
    recebeVr: true,
    ativo: true,
    clientesIds: []
  };
}

export function TeamManagementPanel() {
  const { data, setData } = useOperationalData();
  const { teams, collaborators, clients, schedules } = data;

  const [activeSection, setActiveSection] = useState<'equipes' | 'colaboradores' | 'escalas' | null>(null);
  const [teamForm, setTeamForm] = useState<TeamForm>(defaultTeamForm);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [collaboratorForm, setCollaboratorForm] = useState<CollaboratorForm>(buildDefaultCollaborator(teams));
  const [editingCollaboratorId, setEditingCollaboratorId] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    colaboradorId: collaborators[0]?.id ?? '',
    data: '',
    turno: 'Manhã' as ShiftType
  });

  const scheduleGroupedByDate = useMemo(() => [...schedules].sort((a, b) => a.data.localeCompare(b.data)), [schedules]);

  function toggleSection(sectionId: 'equipes' | 'colaboradores' | 'escalas') {
    setActiveSection((prev) => (prev === sectionId ? null : sectionId));
  }

  function resetCollaboratorForm() {
    setEditingCollaboratorId(null);
    setCollaboratorForm(buildDefaultCollaborator(teams));
  }

  function resetTeamForm() {
    setEditingTeamId(null);
    setTeamForm(defaultTeamForm);
  }

  function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamForm.nome.trim()) return;

    if (editingTeamId) {
      setData((prev) => ({
        ...prev,
        teams: prev.teams.map((team) => (team.id === editingTeamId ? { ...team, ...teamForm, nome: teamForm.nome.trim() } : team))
      }));
      resetTeamForm();
      return;
    }

    setData((prev) => ({
      ...prev,
      teams: [...prev.teams, { id: createId('team'), nome: teamForm.nome.trim(), descricao: teamForm.descricao.trim() }]
    }));
    resetTeamForm();
  }

  function editTeam(team: Team) {
    setTeamForm({ nome: team.nome, descricao: team.descricao });
    setEditingTeamId(team.id);
  }

  function removeTeam(teamId: string) {
    setData((prev) => {
      const fallbackTeamId = prev.teams.find((team) => team.id !== teamId)?.id ?? '';
      return {
        ...prev,
        teams: prev.teams.filter((team) => team.id !== teamId),
        collaborators: prev.collaborators.map((collaborator) =>
          collaborator.equipeId === teamId ? { ...collaborator, equipeId: fallbackTeamId } : collaborator
        )
      };
    });
    if (editingTeamId === teamId) resetTeamForm();
  }

  function saveCollaborator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!collaboratorForm.nome.trim() || !collaboratorForm.email.trim() || !collaboratorForm.equipeId) return;

    if (editingCollaboratorId) {
      setData((prev) => ({
        ...prev,
        collaborators: prev.collaborators.map((item) =>
          item.id === editingCollaboratorId ? { ...item, ...collaboratorForm, nome: collaboratorForm.nome.trim() } : item
        )
      }));
      resetCollaboratorForm();
      return;
    }

    const newCollaborator: Collaborator = {
      ...collaboratorForm,
      id: createId('col'),
      nome: collaboratorForm.nome.trim()
    };

    setData((prev) => ({ ...prev, collaborators: [...prev.collaborators, newCollaborator] }));
    setScheduleForm((prev) => ({ ...prev, colaboradorId: newCollaborator.id }));
    resetCollaboratorForm();
  }

  function editCollaborator(collaborator: Collaborator) {
    setEditingCollaboratorId(collaborator.id);
    setCollaboratorForm({ ...collaborator });
  }

  function removeCollaborator(collaboratorId: string) {
    setData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((item) => item.id !== collaboratorId),
      schedules: prev.schedules.filter((schedule) => schedule.colaboradorId !== collaboratorId)
    }));

    if (editingCollaboratorId === collaboratorId) resetCollaboratorForm();
  }

  function addScheduleEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleForm.colaboradorId || !scheduleForm.data) return;

    setData((prev) => ({
      ...prev,
      schedules: [
        ...prev.schedules,
        { id: createId('escala'), colaboradorId: scheduleForm.colaboradorId, data: scheduleForm.data, turno: scheduleForm.turno }
      ]
    }));

    setScheduleForm((prev) => ({ ...prev, data: '' }));
  }

  function removeSchedule(scheduleId: string) {
    setData((prev) => ({ ...prev, schedules: prev.schedules.filter((item) => item.id !== scheduleId) }));
  }

  function collaboratorName(id: string) {
    return collaborators.find((col) => col.id === id)?.nome ?? 'Não encontrado';
  }

  function teamName(teamId: string) {
    return teams.find((team) => team.id === teamId)?.nome ?? 'Sem equipe';
  }

  function clientNames(clientIds: string[]) {
    const mapped = clientIds.map((id) => clients.find((client) => client.id === id)?.nome).filter(Boolean);
    return mapped.length ? mapped.join(', ') : 'Sem clientes';
  }

  const managementSections = [
    { id: 'equipes' as const, title: 'Gestão de equipes', summary: `${teams.length} equipes cadastradas` },
    { id: 'colaboradores' as const, title: 'Gestão de colaboradores', summary: `${collaborators.length} colaboradores` },
    { id: 'escalas' as const, title: 'Gestão de escalas', summary: `${schedules.length} lançamentos` }
  ];

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold">Central de gestão integrada</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {managementSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => toggleSection(section.id)}
              className={`rounded border p-4 text-left ${activeSection === section.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950'}`}
            >
              <p className="font-semibold">{section.title}</p>
              <p className="mt-3 text-xs uppercase text-slate-400">{section.summary}</p>
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'equipes' && (
        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">1) Criar, editar e excluir equipes</h3>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={saveTeam}>
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nome da equipe" value={teamForm.nome} onChange={(event) => setTeamForm((prev) => ({ ...prev, nome: event.target.value }))} />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Descrição" value={teamForm.descricao} onChange={(event) => setTeamForm((prev) => ({ ...prev, descricao: event.target.value }))} />
            <div className="flex gap-2">
              <button className="rounded bg-sky-600 px-3 py-2 font-medium" type="submit">{editingTeamId ? 'Atualizar' : 'Adicionar'}</button>
              {editingTeamId && <button className="rounded border border-slate-700 px-3 py-2" type="button" onClick={resetTeamForm}>Cancelar</button>}
            </div>
          </form>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id} className="rounded border border-slate-800 bg-slate-950 p-3">
                <p className="font-medium">{team.nome}</p>
                <p className="text-sm text-slate-300">{team.descricao || 'Sem descrição'}</p>
                <div className="mt-2 flex gap-2 text-xs">
                  <button className="rounded border border-amber-500 px-2 py-1" onClick={() => editTeam(team)} type="button">Editar</button>
                  <button className="rounded border border-rose-500 px-2 py-1" onClick={() => removeTeam(team.id)} type="button">Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeSection === 'colaboradores' && (
        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">2) Formulário completo de colaboradores</h3>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveCollaborator}>
            <input required className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nome" value={collaboratorForm.nome} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, nome: event.target.value }))} />
            <input required type="email" className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Email" value={collaboratorForm.email} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, email: event.target.value }))} />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Contato" value={collaboratorForm.telefone} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, telefone: event.target.value }))} />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Cargo" value={collaboratorForm.cargo} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, cargo: event.target.value }))} />
            <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={collaboratorForm.equipeId} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, equipeId: event.target.value }))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.nome}</option>)}
            </select>
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Gestor" value={collaboratorForm.gestor} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, gestor: event.target.value }))} />
            <input type="date" className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={collaboratorForm.dataNascimento} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, dataNascimento: event.target.value }))} />
            <input type="date" className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={collaboratorForm.dataContratacao} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, dataContratacao: event.target.value }))} />
            <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={collaboratorForm.modeloTrabalho} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, modeloTrabalho: event.target.value as WorkModel }))}>
              {workModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <input type="number" min={1} className="rounded border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Carga horária semanal" value={collaboratorForm.cargaHorariaSemanal} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, cargaHorariaSemanal: Number(event.target.value) }))} />
            <label className="text-sm">Clientes atendidos</label>
            <select multiple className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={collaboratorForm.clientesIds} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, clientesIds: Array.from(event.target.selectedOptions, (opt) => opt.value) }))}>
              {clients.map((client: Client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
            </select>
            <div className="md:col-span-2 grid gap-2 md:grid-cols-4 text-sm">
              <label><input type="checkbox" checked={collaboratorForm.fazPlantao} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, fazPlantao: event.target.checked }))} /> Faz plantão</label>
              <label><input type="checkbox" checked={collaboratorForm.sobreAviso} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, sobreAviso: event.target.checked }))} /> Sobreaviso</label>
              <label><input type="checkbox" checked={collaboratorForm.recebeVr} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, recebeVr: event.target.checked }))} /> Recebe VR</label>
              <label><input type="checkbox" checked={collaboratorForm.ativo} onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, ativo: event.target.checked }))} /> Ativo</label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button className="rounded bg-emerald-600 px-3 py-2 font-medium" type="submit">{editingCollaboratorId ? 'Atualizar colaborador' : 'Salvar colaborador'}</button>
              {editingCollaboratorId && <button className="rounded border border-slate-700 px-3 py-2" type="button" onClick={resetCollaboratorForm}>Cancelar</button>}
            </div>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="p-2">Colaborador</th><th className="p-2">Equipe/Gestor</th><th className="p-2">Modelo</th><th className="p-2">Clientes</th><th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {collaborators.map((col) => (
                  <tr key={col.id} className="border-b border-slate-900 align-top">
                    <td className="p-2">{col.nome}<p className="text-slate-400">{col.email} · {col.telefone || 'Sem contato'}</p></td>
                    <td className="p-2">{teamName(col.equipeId)}<p className="text-slate-400">Gestor: {col.gestor || '-'}</p></td>
                    <td className="p-2">{col.modeloTrabalho}<p className="text-slate-400">Plantão: {col.fazPlantao ? 'Sim' : 'Não'} | Sobreaviso: {col.sobreAviso ? 'Sim' : 'Não'} | VR: {col.recebeVr ? 'Sim' : 'Não'}</p></td>
                    <td className="p-2">{clientNames(col.clientesIds)}<p className="text-slate-400">Nascimento: {col.dataNascimento || '-'} · Contratação: {col.dataContratacao || '-'}</p></td>
                    <td className="p-2"><div className="flex gap-2"><button className="rounded border border-amber-500 px-2 py-1" type="button" onClick={() => editCollaborator(col)}>Editar</button><button className="rounded border border-rose-500 px-2 py-1" type="button" onClick={() => removeCollaborator(col.id)}>Excluir</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'escalas' && (
        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">3) Escalas integradas</h3>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={addScheduleEntry}>
            <select required className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={scheduleForm.colaboradorId} onChange={(event) => setScheduleForm((prev) => ({ ...prev, colaboradorId: event.target.value }))}>
              <option value="">Selecione o colaborador</option>
              {collaborators.map((colaborador) => <option key={colaborador.id} value={colaborador.id}>{colaborador.nome}</option>)}
            </select>
            <input required type="date" className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={scheduleForm.data} onChange={(event) => setScheduleForm((prev) => ({ ...prev, data: event.target.value }))} />
            <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2" value={scheduleForm.turno} onChange={(event) => setScheduleForm((prev) => ({ ...prev, turno: event.target.value as ShiftType }))}>
              {shiftOptions.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
            </select>
            <button className="rounded bg-violet-600 px-3 py-2 font-medium" type="submit">Incluir na escala</button>
          </form>
          <div className="mt-4 space-y-2">
            {scheduleGroupedByDate.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <span>{entry.data}</span><span>{collaboratorName(entry.colaboradorId)}</span><span>{entry.turno}</span><button className="rounded border border-rose-500 px-2 py-1" type="button" onClick={() => removeSchedule(entry.id)}>Excluir</button>
              </div>
            ))}
            {scheduleGroupedByDate.length === 0 && <p className="text-sm text-slate-300">Nenhuma escala cadastrada.</p>}
          </div>
        </div>
      )}

      {activeSection === null && <div className="rounded border border-dashed border-slate-700 p-4 text-sm text-slate-300">Nenhum módulo aberto.</div>}
    </div>
  );
}
