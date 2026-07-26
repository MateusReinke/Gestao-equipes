import Link from 'next/link';
import { ArrowLeft, BellRing, CalendarClock } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, type BadgeTone } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { VacationBalance, type Saldo } from './vacation-balance';
import { SweepButton } from './sweep-button';

type Alerta = {
  tipo: string;
  severidade: 'info' | 'aviso' | 'critico';
  colaboradorNome: string;
  equipe: string | null;
  cicloNumero: number;
  diasSaldo: number;
  diasParaLimite: number;
  limiteConcessivo: string;
  titulo: string;
  mensagem: string;
};

type Alertas = { alertas: Alerta[]; semAdmissao: Array<{ nome: string }> };

const TOM: Record<string, BadgeTone> = { critico: 'danger', aviso: 'warn', info: 'info' };
const ROTULO: Record<string, string> = { critico: 'Crítico', aviso: 'Atenção', info: 'Informativo' };

export default async function FeriasPage() {
  const session = await requirePermissionSession(PERMISSIONS.HR_VACATION_VIEW);

  const [saldosResult, alertasResult] = await Promise.all([
    fetchApiSafe<Saldo[]>('/api/ferias/saldos', []),
    fetchApiSafe<Alertas>('/api/ferias/alertas', { alertas: [], semAdmissao: [] }),
  ]);

  const podeAjustar = can(session.permissoes, PERMISSIONS.HR_VACATION_ADJUST);
  const podeVarrer = can(session.permissoes, PERMISSIONS.HR_VACATION_APPROVE);
  const alertas = alertasResult.data.alertas;

  return (
    <>
      <PageHeader
        title="Controle de férias"
        description="O prazo que corre não é o das férias, é o do período concessivo: 12 meses depois de fechado o aquisitivo. Passar dele obriga a pagar em dobro."
        action={
          <>
            <Link href="/rh">
              <Button variant="secondary" size="sm">
                <ArrowLeft size={14} /> Solicitações
              </Button>
            </Link>
            {podeVarrer ? <SweepButton /> : null}
          </>
        }
      />

      <DataStatus error={saldosResult.error ?? alertasResult.error} />

      <Card>
        <CardHeader
          title="Alertas de prazo"
          description={
            alertas.length === 0
              ? 'Nenhum prazo exigindo atenção'
              : `${alertas.length} situação(ões), do mais urgente para o menos`
          }
          action={<BellRing size={15} className="text-ink-subtle" />}
        />

        {alertas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
            Nenhum ciclo vencido ou próximo do limite. O primeiro aviso aparece a 120 dias do prazo — folga suficiente para
            encaixar as férias na escala.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {alertas.map((alerta) => (
              <div
                key={`${alerta.tipo}-${alerta.colaboradorNome}-${alerta.cicloNumero}`}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TOM[alerta.severidade]}>{ROTULO[alerta.severidade]}</Badge>
                    <p className="text-sm font-medium text-ink">{alerta.titulo}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{alerta.mensagem}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-medium text-ink">
                    {alerta.diasParaLimite < 0
                      ? `${Math.abs(alerta.diasParaLimite)}d atrasado`
                      : `${alerta.diasParaLimite}d`}
                  </p>
                  <p className="tabular text-2xs text-ink-subtle">até {formatDate(alerta.limiteConcessivo)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <VacationBalance saldos={saldosResult.data} podeAjustar={podeAjustar} />

      <Card className="mt-4">
        <CardHeader title="Como a conta é feita" action={<CalendarClock size={15} className="text-ink-subtle" />} />
        <div className="px-4 py-4 text-xs leading-relaxed text-ink-muted sm:px-5">
          <p>
            Cada ciclo tem duas janelas de 12 meses. O <strong className="text-ink">período aquisitivo</strong> começa na
            admissão; ao fechar, o direito está adquirido (Art. 130). O{' '}
            <strong className="text-ink">período concessivo</strong> são os 12 meses seguintes, o prazo que a empresa tem
            para conceder (Art. 134). Passar do prazo obriga a pagar o período em dobro (Art. 137).
          </p>
          <p className="mt-2">
            Faltas injustificadas reduzem o direito: até 5 mantêm 30 dias; 6 a 14 caem para 24; 15 a 23 para 18; 24 a 32
            para 12; acima disso o direito é perdido. A conta usa as ausências do tipo <em>falta</em> já aprovadas.
          </p>
          <p className="mt-2">
            O abono pecuniário é limitado a um terço do direito (Art. 143), e o fracionamento vai até 3 períodos, um deles
            com no mínimo 14 dias corridos (Art. 134 §1).
          </p>
          <Alert tone="info">
            <span className="text-xs">
              O Art. 134 §3 impede começar as férias nos 2 dias que antecedem feriado ou repouso semanal. Sem um cadastro de
              feriados, o sistema avisa mas não bloqueia — bloquear com meia regra daria falsa sensação de conformidade.
            </span>
          </Alert>
        </div>
      </Card>
    </>
  );
}
