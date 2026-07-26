import Link from 'next/link';
import { AlarmClock, CalendarClock, Building2, Plane, Repeat2, Users, UserSquare2, CalendarDays } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requireTenantSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { formatDateShort, formatSla, weekdayName } from '@/lib/format';

type Turno = {
  id: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: string;
  status: string;
  cliente?: { nome: string } | null;
  colaborador: { id: number; nome: string; equipe: { nome: string } };
  colaboradorOriginal?: { nome: string } | null;
};

type Troca = {
  id: number;
  tipo: string;
  status: string;
  motivo: string;
  solicitante: { nome: string };
  destinatario: { nome: string };
  turnoOrigem: { data: string };
};

type DashboardData = {
  metrics: {
    clients: number;
    teams: number;
    collaborators: number;
    currentOnCall: number;
    activeVacations: number;
    activeScales: number;
    pendingSwaps: number;
    shiftsNext7Days: number;
  };
  currentOnCall: Turno[];
  upcomingOnCall: Turno[];
  clients: Array<{ id: number; nome: string; escalation: string; slaMinutos?: number | null; responsavelInterno?: { nome: string } | null }>;
  vacations: Array<{ id: number; dataInicio: string; dataFim: string; colaborador: { nome: string } }>;
  pendingSwaps: Troca[];
};

const emptyDashboard: DashboardData = {
  metrics: {
    clients: 0, teams: 0, collaborators: 0, currentOnCall: 0,
    activeVacations: 0, activeScales: 0, pendingSwaps: 0, shiftsNext7Days: 0,
  },
  currentOnCall: [], upcomingOnCall: [], clients: [], vacations: [], pendingSwaps: [],
};

export default async function DashboardPage() {
  const session = await requireTenantSession();
  const { data, error } = await fetchApiSafe<DashboardData>('/api/dashboard', emptyDashboard);
  const podeVerTrocas = can(session.permissoes, PERMISSIONS.SHIFT_VIEW);

  return (
    <>
      <PageHeader
        title={`Bom trabalho, ${session.user.nome.split(' ')[0]}`}
        description={`Visão operacional de ${session.tenant?.nome ?? 'sua empresa'} — quem está em turno agora, o que vem a seguir e o que precisa da sua atenção.`}
      />

      <DataStatus error={error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Em turno agora"
          value={data.metrics.currentOnCall}
          hint={data.metrics.currentOnCall === 0 ? 'Ninguém escalado neste horário' : 'Cobertura ativa'}
          tone={data.metrics.currentOnCall > 0 ? 'ok' : 'warn'}
          icon={<AlarmClock size={16} />}
        />
        <StatCard
          label="Trocas pendentes"
          value={data.metrics.pendingSwaps}
          hint={data.metrics.pendingSwaps > 0 ? 'Aguardando resposta' : 'Nada pendente'}
          tone={data.metrics.pendingSwaps > 0 ? 'warn' : 'neutral'}
          icon={<Repeat2 size={16} />}
        />
        <StatCard
          label="Turnos nos próximos 7 dias"
          value={data.metrics.shiftsNext7Days}
          hint="Já planejados"
          tone="accent"
          icon={<CalendarClock size={16} />}
        />
        <StatCard
          label="Em férias hoje"
          value={data.metrics.activeVacations}
          hint="Indisponíveis para escala"
          tone={data.metrics.activeVacations > 0 ? 'info' : 'neutral'}
          icon={<Plane size={16} />}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard label="Clientes" value={data.metrics.clients} icon={<Building2 size={16} />} />
        <StatCard label="Equipes" value={data.metrics.teams} icon={<Users size={16} />} />
        <StatCard label="Colaboradores ativos" value={data.metrics.collaborators} icon={<UserSquare2 size={16} />} />
      </div>

      {/* items-start: cada card acompanha a própria altura em vez de esticar
          para igualar o vizinho mais alto. */}
      <div className="mt-6 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Em turno agora"
            description="Quem está cobrindo a operação neste momento"
            action={
              <Link href="/turnos" className="text-xs font-medium text-accent hover:underline">
                Ver calendário
              </Link>
            }
          />
          {data.currentOnCall.length === 0 ? (
            <EmptyState
              icon={<AlarmClock size={24} />}
              title="Ninguém em turno neste horário"
              description="Ou a escala ainda não foi gerada para hoje, ou realmente não há cobertura programada agora."
            />
          ) : (
            <div className="divide-y divide-line">
              {data.currentOnCall.map((turno) => (
                <div key={turno.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{turno.colaborador.nome}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {turno.colaborador.equipe.nome} · {turno.cliente?.nome ?? 'Cobertura interna'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {turno.status === 'trocado' && turno.colaboradorOriginal ? (
                      <Badge tone="info">troca de {turno.colaboradorOriginal.nome.split(' ')[0]}</Badge>
                    ) : null}
                    <span className="tabular text-sm font-medium text-ok">
                      {turno.horaInicio}–{turno.horaFim}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximos turnos" description="O que vem a seguir" />
          {data.upcomingOnCall.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="Nada programado"
              description="Gere turnos a partir de uma escala para preencher o calendário."
            />
          ) : (
            <div className="divide-y divide-line">
              {data.upcomingOnCall.slice(0, 6).map((turno) => (
                <div key={turno.id} className="px-4 py-2.5 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-ink">{turno.colaborador.nome}</p>
                    <span className="tabular shrink-0 text-2xs text-ink-subtle">
                      {weekdayName(turno.data, true)} {formatDateShort(turno.data)}
                    </span>
                  </div>
                  <p className="tabular mt-0.5 text-xs text-ink-muted">
                    {turno.horaInicio}–{turno.horaFim} · {turno.cliente?.nome ?? 'Interno'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        {podeVerTrocas ? (
          <Card>
            <CardHeader
              title="Trocas aguardando resposta"
              description="Pedidos abertos entre colaboradores"
              action={
                <Link href="/trocas" className="text-xs font-medium text-accent hover:underline">
                  Ver todas
                </Link>
              }
            />
            {data.pendingSwaps.length === 0 ? (
              <EmptyState icon={<Repeat2 size={24} />} title="Nenhuma troca pendente" />
            ) : (
              <div className="divide-y divide-line">
                {data.pendingSwaps.slice(0, 5).map((troca) => (
                  <div key={troca.id} className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{troca.solicitante.nome}</span>
                        <span className="text-ink-subtle"> ⇄ </span>
                        <span className="font-medium">{troca.destinatario.nome}</span>
                      </p>
                      <Badge tone="warn">{formatDateShort(troca.turnoOrigem.data)}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{troca.motivo}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Clientes monitorados" description="Contato de escalation e SLA" />
          {data.clients.length === 0 ? (
            <EmptyState icon={<Building2 size={24} />} title="Nenhum cliente vinculado às suas equipes" />
          ) : (
            <div className="divide-y divide-line">
              {data.clients.slice(0, 6).map((cliente) => (
                <div key={cliente.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{cliente.nome}</p>
                    <p className="truncate text-xs text-ink-muted">{cliente.escalation}</p>
                  </div>
                  {cliente.slaMinutos ? <Badge tone="accent">SLA {formatSla(cliente.slaMinutos)}</Badge> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
