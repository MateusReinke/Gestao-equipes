'use client';

import { FormEvent, useMemo, useState } from 'react';

type ShiftType = 'Manhã' | 'Tarde' | 'Noite' | 'Plantão';

type Collaborator = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  equipe: string;
  cargaHorariaSemanal: number;
  ativo: boolean;
};

type Team = {
  id: string;
  nome: string;
  descricao: string;
};

type ScheduleEntry = {
  id: string;
  colaboradorId: string;
  data: string;
  turno: ShiftType;
};

type CollaboratorForm = Omit<Collaborator, 'id'>;

const defaultCollaborator: CollaboratorForm = {
  nome: '',
  email: '',
  telefone: '',
  cargo: '',
  equipe: '',
  cargaHorariaSemanal: 40,
  ativo: true
};

const defaultTeams: Team[] = [
  { id: 'team-1', nome: 'NOC', descricao: 'Monitoramento e resposta a incidentes.' },
  { id: 'team-2', nome: 'Service Desk', descricao: 'Atendimento de chamados e suporte N1.' },
  { id: 'team-3', nome: 'Infraestrutura', descricao: 'Gestão de servidores, rede e cloud.' }
];

const defaultCollaborators: Collaborator[] = [
  {
    id: 'col-1',
    nome: 'Ana Lima',
    email: 'ana.lima@empresa.com',
    telefone: '(11) 98888-1111',
    cargo: 'Analista NOC',
    equipe: 'NOC',
    cargaHorariaSemanal: 40,
    ativo: true
  },
  {
    id: 'col-2',
    nome: 'Bruno Souza',
    email: 'bruno.souza@empresa.com',
    telefone: '(11) 97777-2222',
    cargo: 'Analista Service Desk',
    equipe: 'Service Desk',
    cargaHorariaSemanal: 36,
    ativo: true
  }
];

const shiftOptions: ShiftType[] = ['Manhã', 'Tarde', 'Noite', 'Plantão'];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TeamManagementPanel() {
  const [activeSection, setActiveSection] = useState<'equipes' | 'colaboradores' | 'escalas' | null>(null);
  const [teamForm, setTeamForm] = useState({ nome: '', descricao: '' });
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [collaboratorForm, setCollaboratorForm] = useState<CollaboratorForm>(defaultCollaborator);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(defaultCollaborators);
  const [scheduleForm, setScheduleForm] = useState({
    colaboradorId: defaultCollaborators[0]?.id ?? '',
    data: '',
    turno: 'Manhã' as ShiftType
  });
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);

  const teamNames = useMemo(() => teams.map((team) => team.nome), [teams]);

  function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamForm.nome.trim()) return;

    const newTeam: Team = {
      id: createId('team'),
      nome: teamForm.nome.trim(),
      descricao: teamForm.descricao.trim()
    };

    setTeams((prev) => [...prev, newTeam]);
    setTeamForm({ nome: '', descricao: '' });

    if (!collaboratorForm.equipe) {
      setCollaboratorForm((prev) => ({ ...prev, equipe: newTeam.nome }));
    }
  }

  function addCollaborator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collaboratorForm.nome.trim() || !collaboratorForm.email.trim() || !collaboratorForm.equipe) {
      return;
    }

    const newCollaborator: Collaborator = {
      ...collaboratorForm,
      id: createId('col')
    };

    setCollaborators((prev) => [...prev, newCollaborator]);
    setCollaboratorForm(defaultCollaborator);
    setScheduleForm((prev) => ({ ...prev, colaboradorId: newCollaborator.id }));
  }

  function addScheduleEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!scheduleForm.colaboradorId || !scheduleForm.data) return;

    const newEntry: ScheduleEntry = {
      id: createId('escala'),
      colaboradorId: scheduleForm.colaboradorId,
      data: scheduleForm.data,
      turno: scheduleForm.turno
    };

    setScheduleEntries((prev) => [...prev, newEntry]);
    setScheduleForm((prev) => ({ ...prev, data: '' }));
  }

  function collaboratorName(id: string) {
    return collaborators.find((col) => col.id === id)?.nome ?? 'Não encontrado';
  }

  const scheduleGroupedByDate = useMemo(() => {
    return [...scheduleEntries].sort((a, b) => a.data.localeCompare(b.data));
  }, [scheduleEntries]);

  const managementSections = [
    {
      id: 'equipes' as const,
      title: 'Gestão de equipes',
      description: 'Crie e organize as torres e frentes de atuação.',
      summary: `${teams.length} equipes cadastradas`
    },
    {
      id: 'colaboradores' as const,
      title: 'Gestão de colaboradores',
      description: 'Cadastre e ajuste dados de contato, cargo e vínculo.',
      summary: `${collaborators.length} colaboradores cadastrados`
    },
    {
      id: 'escalas' as const,
      title: 'Gestão de escalas',
      description: 'Monte a escala operacional por colaborador e turno.',
      summary: `${scheduleEntries.length} lançamentos de escala`
    }
  ];

  function toggleSection(sectionId: 'equipes' | 'colaboradores' | 'escalas') {
    setActiveSection((prev) => (prev === sectionId ? null : sectionId));
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Central de gestão</h3>
          <p className="text-sm text-slate-300">
            Escolha uma área para abrir somente o módulo que deseja editar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {managementSections.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`rounded border p-4 text-left transition ${
                  isActive
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                }`}
              >
                <p className="font-semibold">{section.title}</p>
                <p className="mt-1 text-sm text-slate-300">{section.description}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">{section.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === 'equipes' && (
        <div className="card">
        <h3 className="mb-3 text-lg font-semibold">1) Cadastro de equipes</h3>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={addTeam}>
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Nome da equipe"
            value={teamForm.nome}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, nome: event.target.value }))}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Descrição (opcional)"
            value={teamForm.descricao}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, descricao: event.target.value }))}
          />
          <button className="rounded bg-sky-600 px-3 py-2 font-medium hover:bg-sky-500" type="submit">
            Adicionar equipe
          </button>
        </form>

        <ul className="mt-4 grid gap-2 md:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id} className="rounded border border-slate-800 bg-slate-950 p-3">
              <p className="font-medium">{team.nome}</p>
              <p className="text-sm text-slate-300">{team.descricao || 'Sem descrição'}</p>
            </li>
          ))}
        </ul>
      </div>
      )}

      {activeSection === 'colaboradores' && (
        <div className="card">
        <h3 className="mb-3 text-lg font-semibold">2) Cadastro de colaboradores</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={addCollaborator}>
          <input
            required
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Nome completo"
            value={collaboratorForm.nome}
            onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, nome: event.target.value }))}
          />
          <input
            required
            type="email"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="E-mail corporativo"
            value={collaboratorForm.email}
            onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Telefone"
            value={collaboratorForm.telefone}
            onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, telefone: event.target.value }))}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Cargo"
            value={collaboratorForm.cargo}
            onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, cargo: event.target.value }))}
          />
          <select
            required
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={collaboratorForm.equipe}
            onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, equipe: event.target.value }))}
          >
            <option value="">Selecione a equipe</option>
            {teamNames.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Carga horária semanal"
            value={collaboratorForm.cargaHorariaSemanal}
            onChange={(event) =>
              setCollaboratorForm((prev) => ({ ...prev, cargaHorariaSemanal: Number(event.target.value) }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={collaboratorForm.ativo}
              onChange={(event) => setCollaboratorForm((prev) => ({ ...prev, ativo: event.target.checked }))}
            />
            Colaborador ativo
          </label>
          <button className="rounded bg-emerald-600 px-3 py-2 font-medium hover:bg-emerald-500" type="submit">
            Salvar colaborador
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="p-2">Nome</th>
                <th className="p-2">Equipe</th>
                <th className="p-2">Cargo</th>
                <th className="p-2">Contato</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((colaborador) => (
                <tr key={colaborador.id} className="border-b border-slate-900">
                  <td className="p-2">{colaborador.nome}</td>
                  <td className="p-2">{colaborador.equipe}</td>
                  <td className="p-2">{colaborador.cargo || '-'}</td>
                  <td className="p-2">
                    <p>{colaborador.email}</p>
                    <p className="text-slate-400">{colaborador.telefone || 'Sem telefone'}</p>
                  </td>
                  <td className="p-2">{colaborador.ativo ? 'Ativo' : 'Inativo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeSection === 'escalas' && (
        <div className="card">
        <h3 className="mb-3 text-lg font-semibold">3) Montagem de escala</h3>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={addScheduleEntry}>
          <select
            required
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={scheduleForm.colaboradorId}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, colaboradorId: event.target.value }))}
          >
            <option value="">Selecione o colaborador</option>
            {collaborators.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nome}
              </option>
            ))}
          </select>

          <input
            required
            type="date"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={scheduleForm.data}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, data: event.target.value }))}
          />

          <select
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={scheduleForm.turno}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, turno: event.target.value as ShiftType }))}
          >
            {shiftOptions.map((shift) => (
              <option key={shift} value={shift}>
                {shift}
              </option>
            ))}
          </select>

          <button className="rounded bg-violet-600 px-3 py-2 font-medium hover:bg-violet-500" type="submit">
            Incluir na escala
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {scheduleGroupedByDate.length === 0 && <p className="text-sm text-slate-300">Nenhuma escala criada ainda.</p>}
          {scheduleGroupedByDate.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
              <span>{entry.data}</span>
              <span className="font-medium">{collaboratorName(entry.colaboradorId)}</span>
              <span>{entry.turno}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {activeSection === null && (
        <div className="rounded border border-dashed border-slate-700 p-4 text-sm text-slate-300">
          Nenhum módulo aberto. Clique em uma opção da Central de gestão para começar.
        </div>
      )}
    </div>
  );
}
