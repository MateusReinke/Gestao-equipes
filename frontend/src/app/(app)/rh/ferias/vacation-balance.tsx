'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarCheck, ChevronDown, ChevronRight, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Table, Td, Th, Tr, cx, type BadgeTone } from '@/components/ui';
import { formatDate } from '@/lib/format';

export type Ciclo = {
  numero: number;
  inicio: string;
  fim: string;
  limiteConcessivo: string;
  diasDireito: number;
  faltasInjustificadas: number;
  diasGozados: number;
  diasAbono: number;
  diasAjuste: number;
  diasSaldo: number;
  status: string;
  diasParaLimite: number | null;
};

export type Saldo = {
  colaboradorId: number;
  nome: string;
  equipe: { id: number; nome: string } | null;
  tipoContrato: string;
  ativo: boolean;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  ciclos: Ciclo[] | null;
  diasEmAberto: number;
};

const STATUS: Record<string, { rotulo: string; tom: BadgeTone }> = {
  em_curso: { rotulo: 'Aquisitivo em curso', tom: 'neutral' },
  disponivel: { rotulo: 'Disponível', tom: 'ok' },
  parcialmente_gozado: { rotulo: 'Parcialmente gozado', tom: 'info' },
  concluido: { rotulo: 'Concluído', tom: 'neutral' },
  vencido: { rotulo: 'Vencido', tom: 'danger' },
};

/// O tom da linha vem do prazo, não só do status: 45 dias é o limiar em que
/// ainda dá para encaixar as férias na escala sem virar emergência.
function tomDoPrazo(ciclo: Ciclo): BadgeTone {
  if (ciclo.status === 'vencido') return 'danger';
  if (ciclo.diasParaLimite == null) return 'neutral';
  if (ciclo.diasParaLimite <= 45) return 'danger';
  if (ciclo.diasParaLimite <= 120) return 'warn';
  return 'neutral';
}

function prazoLegivel(ciclo: Ciclo) {
  if (ciclo.diasParaLimite == null) return '—';
  if (ciclo.diasParaLimite < 0) return `vencido há ${Math.abs(ciclo.diasParaLimite)}d`;
  return `${ciclo.diasParaLimite}d`;
}

function AjustePanel({ saldo, onFechar }: { saldo: Saldo; onFechar: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErro(null);

    const dados = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/ferias/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorId: saldo.colaboradorId,
          cicloNumero: Number(dados.get('cicloNumero')),
          diasDelta: Number(dados.get('diasDelta')),
          motivo: String(dados.get('motivo') || ''),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErro(payload.error || 'Não foi possível registrar o ajuste.');
        return;
      }

      onFechar();
      router.refresh();
    } catch {
      setErro('Falha de comunicação com o servidor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-3 border-t border-line bg-surface-raised p-4 sm:grid-cols-4">
      <Field label="Ciclo" htmlFor={`ciclo-${saldo.colaboradorId}`}>
        <select id={`ciclo-${saldo.colaboradorId}`} name="cicloNumero" className="input-base" required>
          {(saldo.ciclos ?? []).map((ciclo) => (
            <option key={ciclo.numero} value={ciclo.numero}>
              Ciclo {ciclo.numero} ({formatDate(ciclo.inicio)} – {formatDate(ciclo.fim)})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Dias" htmlFor={`delta-${saldo.colaboradorId}`} hint="Positivo concede, negativo retira">
        <Input id={`delta-${saldo.colaboradorId}`} name="diasDelta" type="number" required placeholder="-5" />
      </Field>

      <Field label="Motivo" htmlFor={`motivo-${saldo.colaboradorId}`} className="sm:col-span-2">
        <Input
          id={`motivo-${saldo.colaboradorId}`}
          name="motivo"
          required
          minLength={5}
          placeholder="Acordo coletivo, correção de cadastro..."
        />
      </Field>

      <div className="flex items-center gap-2 sm:col-span-4">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? 'Registrando...' : 'Registrar ajuste'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onFechar}>
          Cancelar
        </Button>
        <span className="text-2xs text-ink-subtle">
          O ajuste altera direito trabalhista e fica registrado na auditoria com o seu nome.
        </span>
      </div>

      {erro ? (
        <div className="sm:col-span-4">
          <Alert tone="danger">{erro}</Alert>
        </div>
      ) : null}
    </form>
  );
}

function LinhaColaborador({ saldo, podeAjustar }: { saldo: Saldo; podeAjustar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  const semAdmissao = saldo.ciclos === null;
  const pior = (saldo.ciclos ?? [])
    .filter((ciclo) => ciclo.status !== 'em_curso' && ciclo.diasSaldo > 0)
    .sort((a, b) => (a.diasParaLimite ?? 9999) - (b.diasParaLimite ?? 9999))[0];

  return (
    <>
      <Tr className={saldo.ativo ? '' : 'opacity-55'}>
        <Td>
          <button
            type="button"
            onClick={() => setAberto((valor) => !valor)}
            className="flex items-center gap-1.5 text-left"
            aria-expanded={aberto}
          >
            {aberto ? (
              <ChevronDown size={14} className="shrink-0 text-ink-subtle" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-ink-subtle" />
            )}
            <span>
              <span className="block font-medium text-ink">{saldo.nome}</span>
              <span className="block text-2xs text-ink-subtle">{saldo.equipe?.nome ?? 'Sem equipe'}</span>
            </span>
          </button>
        </Td>
        <Td className="tabular whitespace-nowrap">
          {saldo.dataAdmissao ? formatDate(saldo.dataAdmissao) : <span className="text-warn">não informada</span>}
        </Td>
        <Td className="tabular text-right font-medium text-ink">{semAdmissao ? '—' : `${saldo.diasEmAberto}d`}</Td>
        <Td>
          {semAdmissao ? (
            <Badge tone="warn">sem cálculo</Badge>
          ) : pior ? (
            <Badge tone={tomDoPrazo(pior)}>
              ciclo {pior.numero} · {prazoLegivel(pior)}
            </Badge>
          ) : (
            <Badge tone="neutral">em dia</Badge>
          )}
        </Td>
        <Td>
          {podeAjustar && !semAdmissao ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAjustando((valor) => !valor)} title="Ajustar saldo">
                <SlidersHorizontal size={14} />
              </Button>
            </div>
          ) : null}
        </Td>
      </Tr>

      {ajustando ? (
        <Tr>
          <Td colSpan={5} className="p-0">
            <AjustePanel saldo={saldo} onFechar={() => setAjustando(false)} />
          </Td>
        </Tr>
      ) : null}

      {aberto ? (
        <Tr>
          <Td colSpan={5} className="bg-surface-raised p-0">
            {semAdmissao ? (
              <p className="flex items-center gap-2 px-4 py-4 text-xs text-warn">
                <TriangleAlert size={14} className="shrink-0" />
                Sem data de admissão não há como calcular os períodos aquisitivo e concessivo. Preencha no cadastro do
                colaborador.
              </p>
            ) : (
              <div className="scroll-x px-4 py-3">
                <table className="w-full min-w-[46rem] text-xs">
                  <thead>
                    <tr className="text-ink-subtle">
                      <th className="py-1.5 text-left font-medium">Ciclo</th>
                      <th className="py-1.5 text-left font-medium">Aquisitivo</th>
                      <th className="py-1.5 text-left font-medium">Conceder até</th>
                      <th className="py-1.5 text-right font-medium">Direito</th>
                      <th className="py-1.5 text-right font-medium">Faltas</th>
                      <th className="py-1.5 text-right font-medium">Gozados</th>
                      <th className="py-1.5 text-right font-medium">Abono</th>
                      <th className="py-1.5 text-right font-medium">Ajuste</th>
                      <th className="py-1.5 pr-4 text-right font-medium">Saldo</th>
                      <th className="py-1.5 text-left font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(saldo.ciclos ?? []).map((ciclo) => {
                      const meta = STATUS[ciclo.status] ?? { rotulo: ciclo.status, tom: 'neutral' as BadgeTone };
                      return (
                        <tr key={ciclo.numero} className="border-t border-line">
                          <td className="tabular py-2">{ciclo.numero}</td>
                          <td className="tabular py-2 whitespace-nowrap">
                            {formatDate(ciclo.inicio)} – {formatDate(ciclo.fim)}
                          </td>
                          <td className="tabular py-2 whitespace-nowrap">
                            <span className={cx(tomDoPrazo(ciclo) === 'danger' && 'text-danger')}>
                              {formatDate(ciclo.limiteConcessivo)}
                            </span>
                            <span className="ml-1.5 text-ink-subtle">({prazoLegivel(ciclo)})</span>
                          </td>
                          <td className="tabular py-2 text-right">{ciclo.diasDireito}</td>
                          <td className="tabular py-2 text-right">
                            {ciclo.faltasInjustificadas > 5 ? (
                              <span className="text-warn" title="Faltas injustificadas reduziram o direito (Art. 130)">
                                {ciclo.faltasInjustificadas}
                              </span>
                            ) : (
                              ciclo.faltasInjustificadas
                            )}
                          </td>
                          <td className="tabular py-2 text-right">{ciclo.diasGozados}</td>
                          <td className="tabular py-2 text-right">{ciclo.diasAbono}</td>
                          <td className="tabular py-2 text-right">
                            {ciclo.diasAjuste !== 0 ? (ciclo.diasAjuste > 0 ? `+${ciclo.diasAjuste}` : ciclo.diasAjuste) : '—'}
                          </td>
                          <td className="tabular py-2 pr-4 text-right font-medium text-ink">{ciclo.diasSaldo}</td>
                          <td className="py-2">
                            <Badge tone={meta.tom}>{meta.rotulo}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-2xs text-ink-subtle">
                  O ciclo em curso mostra a projeção do direito com as faltas lançadas até hoje — ele só se consolida quando o
                  período aquisitivo fecha.
                </p>
              </div>
            )}
          </Td>
        </Tr>
      ) : null}
    </>
  );
}

export function VacationBalance({ saldos, podeAjustar }: { saldos: Saldo[]; podeAjustar: boolean }) {
  const semAdmissao = saldos.filter((saldo) => saldo.ciclos === null);
  const vencidos = saldos.filter((saldo) => saldo.ciclos?.some((ciclo) => ciclo.status === 'vencido'));

  return (
    <Card className="mt-4">
      <CardHeader
        title="Saldo de férias"
        description="Períodos aquisitivo e concessivo por pessoa. Clique no nome para abrir os ciclos."
        action={<CalendarCheck size={15} className="text-ink-subtle" />}
      />

      {vencidos.length > 0 ? (
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <Alert tone="danger">
            <span className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                {vencidos.length} pessoa(s) com ciclo vencido: {vencidos.map((s) => s.nome).join(', ')}. Períodos não
                concedidos dentro do prazo são pagos em dobro (Art. 137).
              </span>
            </span>
          </Alert>
        </div>
      ) : null}

      {semAdmissao.length > 0 ? (
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <Alert tone="warn">
            {semAdmissao.length} colaborador(es) sem data de admissão ficam fora de todo o controle de férias:{' '}
            {semAdmissao.map((s) => s.nome).join(', ')}.
          </Alert>
        </div>
      ) : null}

      {saldos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
          Nenhum colaborador com contrato CLT ou de estágio nas suas equipes. PJ e terceirizado não geram direito a férias
          com esta empresa.
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Colaborador</Th>
              <Th>Admissão</Th>
              <Th className="text-right">Em aberto</Th>
              <Th>Prazo mais curto</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {saldos.map((saldo) => (
              <LinhaColaborador key={saldo.colaboradorId} saldo={saldo} podeAjustar={podeAjustar} />
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
