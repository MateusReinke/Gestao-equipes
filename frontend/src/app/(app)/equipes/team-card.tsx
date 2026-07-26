'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { DeleteButton } from '@/components/delete-button';
import { TeamForm } from './team-form';

type Team = {
  id: number;
  nome: string;
  ativo: boolean;
  cliente?: { id: number; nome: string } | null;
  colaboradores: Array<{ id: number; nome: string; cargo: string }>;
  gestores: Array<{ gestor: { id: number; nome: string; email: string } }>;
};

type Client = { id: number; nome: string };

export function TeamCard({
  team,
  clients,
  podeEditar,
  podeRemover,
}: {
  team: Team;
  clients: Client[];
  podeEditar: boolean;
  podeRemover: boolean;
}) {
  const [editando, setEditando] = useState(false);

  // Em edição o card vira o próprio formulário, ocupando o mesmo lugar na
  // grade — sem modal e sem tirar a pessoa do contexto da lista.
  if (editando) {
    return (
      <TeamForm
        clients={clients}
        equipe={{ id: team.id, nome: team.nome, ativo: team.ativo, cliente: team.cliente }}
        onFechar={() => setEditando(false)}
      />
    );
  }

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-semibold text-ink">{team.nome}</h2>
        <Badge tone={team.ativo ? 'ok' : 'neutral'}>{team.ativo ? 'Ativa' : 'Inativa'}</Badge>
      </div>

      <p className="mt-1 text-xs text-ink-muted">{team.cliente?.nome ?? 'Estrutura interna'}</p>

      {team.gestores.length > 0 ? (
        <p className="mt-2 text-xs text-ink-subtle">Gestão: {team.gestores.map((item) => item.gestor.nome).join(', ')}</p>
      ) : null}

      <div className="mt-4 flex-1 border-t border-line pt-3">
        <p className="eyebrow mb-2">
          {team.colaboradores.length} {team.colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}
        </p>
        {team.colaboradores.length === 0 ? (
          <p className="text-xs text-ink-subtle">Nenhum colaborador ativo nesta equipe ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {team.colaboradores.map((colaborador) => (
              <li key={colaborador.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink">{colaborador.nome}</span>
                <span className="shrink-0 text-2xs text-ink-subtle">{colaborador.cargo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {podeEditar || podeRemover ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-line pt-3">
          {podeEditar ? (
            <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
              <Pencil size={14} /> Editar
            </Button>
          ) : null}
          {podeRemover ? (
            <DeleteButton url={`/api/equipes/${team.id}`} confirmacao={`Remover a equipe ${team.nome}?`} />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
