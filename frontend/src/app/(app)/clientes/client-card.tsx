'use client';

import { useState } from 'react';
import { Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { DeleteButton } from '@/components/delete-button';
import { formatCnpj, formatPhone, formatSla } from '@/lib/format';
import { ClientForm, type ClienteExistente } from './client-form';
import { ClientResponsible } from './client-responsible';

type Colaborador = { id: number; nome: string; equipe?: { nome: string } };

export type Client = ClienteExistente & {
  ativo: boolean;
  equipes: Array<{ id: number; nome: string }>;
  responsavelInterno?: { id: number; nome: string; equipe: { nome: string } } | null;
};

function enderecoResumo(cliente: Client) {
  const linha = [cliente.logradouro, cliente.numero].filter(Boolean).join(', ');
  const cidade = [cliente.cidade, cliente.uf].filter(Boolean).join(' / ');
  return [linha, cliente.bairro, cidade].filter(Boolean).join(' · ') || null;
}

export function ClientCard({
  cliente,
  colaboradores,
  podeEditar,
  podeRemover,
}: {
  cliente: Client;
  colaboradores: Colaborador[];
  podeEditar: boolean;
  podeRemover: boolean;
}) {
  const [editando, setEditando] = useState(false);

  // Em edição o card cede o lugar ao formulário completo — o mesmo usado no
  // cadastro, com busca de CNPJ e CEP inclusas.
  if (editando) {
    return <ClientForm colaboradores={colaboradores} cliente={cliente} onFechar={() => setEditando(false)} />;
  }

  const endereco = enderecoResumo(cliente);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink">{cliente.nome}</h2>
          {cliente.razaoSocial ? <p className="truncate text-xs text-ink-muted">{cliente.razaoSocial}</p> : null}
          {cliente.cnpj ? <p className="tabular mt-0.5 text-2xs text-ink-subtle">CNPJ {formatCnpj(cliente.cnpj)}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {cliente.slaMinutos ? <Badge tone="accent">SLA {formatSla(cliente.slaMinutos)}</Badge> : null}
          <Badge tone={cliente.ativo ? 'ok' : 'danger'}>{cliente.ativo ? 'Ativo' : 'Inativo'}</Badge>
        </div>
      </div>

      <dl className="mt-4 grid gap-2.5 text-sm">
        <div className="flex items-start gap-2">
          <Mail size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
          <div className="min-w-0">
            <dt className="sr-only">Escalation</dt>
            <dd className="truncate text-ink-muted">{cliente.escalation}</dd>
          </div>
        </div>

        {cliente.telefone ? (
          <div className="flex items-start gap-2">
            <Phone size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
            <dd className="text-ink-muted">{formatPhone(cliente.telefone)}</dd>
          </div>
        ) : null}

        {endereco ? (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
            <dd className="text-ink-muted">{endereco}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <p className="eyebrow">Responsável interno</p>
        <p className="mt-1 text-sm text-ink">
          {cliente.responsavelInterno
            ? `${cliente.responsavelInterno.nome} · ${cliente.responsavelInterno.equipe.nome}`
            : 'Sem responsável definido'}
        </p>
        {podeEditar ? (
          <ClientResponsible
            clientId={cliente.id}
            currentResponsibleId={cliente.responsavelInterno?.id ?? null}
            colaboradores={colaboradores}
          />
        ) : null}
      </div>

      {cliente.equipes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cliente.equipes.map((equipe) => (
            <Badge key={equipe.id}>{equipe.nome}</Badge>
          ))}
        </div>
      ) : null}

      {cliente.observacoes ? (
        <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-xs text-ink-muted">{cliente.observacoes}</p>
      ) : null}

      {podeEditar || podeRemover ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-line pt-3">
          {podeEditar ? (
            <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
              <Pencil size={14} /> Editar
            </Button>
          ) : null}
          {podeRemover ? (
            <DeleteButton url={`/api/clientes/${cliente.id}`} confirmacao={`Remover o cliente ${cliente.nome}?`} />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
