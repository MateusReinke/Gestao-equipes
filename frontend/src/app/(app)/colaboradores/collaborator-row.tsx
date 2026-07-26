'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge, Button, Td, Tr } from '@/components/ui';
import { DeleteButton } from '@/components/delete-button';
import { CONTRATO_LABELS, MODELO_LABELS, formatPhone } from '@/lib/format';
import { CollaboratorForm, type ColaboradorExistente } from './collaborator-form';

type Team = { id: number; nome: string };

export function CollaboratorRow({
  colaborador,
  teams,
  podeEditar,
  podeRemover,
  colunas,
}: {
  colaborador: ColaboradorExistente;
  teams: Team[];
  podeEditar: boolean;
  podeRemover: boolean;
  /** quantas colunas a tabela tem, para o formulário ocupar a linha inteira */
  colunas: number;
}) {
  const [editando, setEditando] = useState(false);

  // Em edição a linha abre o formulário logo abaixo, ocupando a largura toda.
  // Assim a pessoa continua vendo a tabela e não perde o contexto de quem está
  // editando — o que um modal por cima esconderia.
  if (editando) {
    return (
      <Tr>
        <Td colSpan={colunas} className="p-0">
          <CollaboratorForm teams={teams} colaborador={colaborador} onFechar={() => setEditando(false)} />
        </Td>
      </Tr>
    );
  }

  return (
    <Tr className={colaborador.ativo ? '' : 'opacity-55'}>
      <Td>
        <p className="font-medium text-ink">{colaborador.nome}</p>
        <p className="text-2xs text-ink-subtle">{colaborador.email}</p>
      </Td>
      <Td>{colaborador.cargo}</Td>
      <Td>{colaborador.equipe.nome}</Td>
      <Td>
        <p>{CONTRATO_LABELS[colaborador.tipoContrato] ?? colaborador.tipoContrato}</p>
        <p className="text-2xs text-ink-subtle">{MODELO_LABELS[colaborador.modeloTrabalho] ?? colaborador.modeloTrabalho}</p>
      </Td>
      <Td className="tabular">{formatPhone(colaborador.telefone)}</Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {colaborador.fazPlantao ? <Badge tone="accent">Plantão</Badge> : null}
          {colaborador.sobreAviso ? <Badge tone="warn">Sobreaviso</Badge> : null}
          {!colaborador.fazPlantao && !colaborador.sobreAviso ? <span className="text-2xs text-ink-subtle">—</span> : null}
          {!colaborador.ativo ? <Badge tone="danger">Inativo</Badge> : null}
        </div>
      </Td>
      {podeEditar || podeRemover ? (
        <Td>
          <div className="flex items-center justify-end gap-1">
            {podeEditar ? (
              <Button variant="ghost" size="sm" onClick={() => setEditando(true)} title="Editar colaborador">
                <Pencil size={14} />
              </Button>
            ) : null}
            {podeRemover ? (
              <DeleteButton
                url={`/api/colaboradores/${colaborador.id}`}
                rotulo=""
                confirmacao={`Remover ${colaborador.nome}?`}
              />
            ) : null}
          </div>
        </Td>
      ) : null}
    </Tr>
  );
}
