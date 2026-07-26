import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { formatCep, formatCnpj, formatPhone, formatSla } from '@/lib/format';
import { ClientForm } from './client-form';
import { ClientResponsible } from './client-responsible';

type Client = {
  id: number;
  nome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  idWhatsapp: string;
  escalation: string;
  telefone?: string | null;
  site?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  slaMinutos?: number | null;
  observacoes?: string | null;
  ativo: boolean;
  responsavelInterno?: { id: number; nome: string; email: string; telefone: string; equipe: { nome: string } } | null;
  equipes: Array<{ id: number; nome: string }>;
};

type Colaborador = { id: number; nome: string };

function enderecoResumo(cliente: Client) {
  const linha1 = [cliente.logradouro, cliente.numero].filter(Boolean).join(', ');
  const linha2 = [cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(' · ');
  const cep = formatCep(cliente.cep);
  return [linha1, linha2, cep].filter(Boolean).join(' — ') || null;
}

export default async function ClientesPage() {
  const session = await requirePermissionSession(PERMISSIONS.CLIENT_VIEW);

  const [clientesResult, colaboradoresResult] = await Promise.all([
    fetchApiSafe<Client[]>('/api/clientes', []),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
  ]);

  const podeCriar = can(session.permissoes, PERMISSIONS.CLIENT_CREATE);
  const podeEditar = can(session.permissoes, PERMISSIONS.CLIENT_EDIT);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Empresas atendidas pela operação, com contato de escalation, SLA e responsável interno."
      />

      <DataStatus error={clientesResult.error} />

      {podeCriar ? <ClientForm colaboradores={colaboradoresResult.data} /> : null}

      {clientesResult.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Building2 size={24} />}
            title="Nenhum cliente cadastrado"
            description={podeCriar ? 'Cadastre o primeiro cliente usando o botão acima.' : 'Ainda não há clientes cadastrados nesta empresa.'}
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {clientesResult.data.map((cliente) => {
            const endereco = enderecoResumo(cliente);
            return (
              <Card key={cliente.id} className="p-4 sm:p-5">
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
                      colaboradores={colaboradoresResult.data}
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
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
