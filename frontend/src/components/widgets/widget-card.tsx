import { AlarmClock, Building2, CalendarClock, Plane, Repeat2, StickyNote, TriangleAlert } from 'lucide-react';
import { Badge, Card, CardHeader, cx } from '@/components/ui';
import { formatDateShort, formatSla, weekdayName } from '@/lib/format';
import { METRIC_LABELS, type MetricKey, type WidgetResult } from '@/lib/widgets';

/* ---------------------------------------------------------------- Blocos */

function Vazio({ texto }: { texto: string }) {
  return <p className="px-4 py-6 text-center text-xs text-ink-subtle sm:px-5">{texto}</p>;
}

function Linhas({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>;
}

/// Barra proporcional ao maior valor da série. Sem biblioteca de gráfico:
/// o dado é pequeno e uma div com largura percentual comunica igual.
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const porcentagem = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${porcentagem}%` }} />
    </div>
  );
}

/* --------------------------------------------------------------- Widgets */

type Lista = Array<Record<string, unknown>>;

function comoLista(dados: unknown): Lista {
  return Array.isArray(dados) ? (dados as Lista) : [];
}

function Metrica({ dados, opcoes, titulo }: { dados: unknown; opcoes: WidgetResult['opcoes']; titulo: string }) {
  const conteudo = (dados ?? {}) as { valor?: number; unidade?: string };
  const rotulo = opcoes.metrica ? METRIC_LABELS[opcoes.metrica as MetricKey] : null;
  // Quem monta o painel costuma nomear o widget com a própria métrica; repetir
  // o rótulo embaixo do número só ocuparia espaço dizendo a mesma coisa.
  const legenda = rotulo && rotulo.toLowerCase() !== titulo.trim().toLowerCase() ? rotulo : conteudo.unidade;

  return (
    <div className="px-4 pb-4 pt-2 sm:px-5">
      <p className="tabular text-3xl font-semibold text-ink">{conteudo.valor ?? 0}</p>
      {legenda ? <p className="mt-1 text-xs text-ink-muted">{legenda}</p> : null}
    </div>
  );
}

function EmTurnoAgora({ dados }: { dados: unknown }) {
  const itens = comoLista(dados);
  if (itens.length === 0) return <Vazio texto="Ninguém em turno neste horário" />;

  return (
    <Linhas>
      {itens.map((item) => (
        <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{String(item.colaborador)}</p>
            <p className="truncate text-xs text-ink-muted">
              {String(item.equipe ?? '—')} · {item.cliente ? String(item.cliente) : 'Cobertura interna'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {item.colaboradorOriginal ? (
              <Badge tone="info">era {String(item.colaboradorOriginal).split(' ')[0]}</Badge>
            ) : null}
            <span className="tabular text-sm font-medium text-ok">
              {String(item.horaInicio)}–{String(item.horaFim)}
            </span>
          </div>
        </div>
      ))}
    </Linhas>
  );
}

function ProximosTurnos({ dados }: { dados: unknown }) {
  const itens = comoLista(dados);
  if (itens.length === 0) return <Vazio texto="Nada programado — gere turnos a partir de uma escala" />;

  return (
    <Linhas>
      {itens.map((item) => (
        <div key={String(item.id)} className="px-4 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm text-ink">{String(item.colaborador)}</p>
            <span className="tabular shrink-0 text-2xs text-ink-subtle">
              {weekdayName(String(item.data), true)} {formatDateShort(String(item.data))}
            </span>
          </div>
          <p className="tabular mt-0.5 text-xs text-ink-muted">
            {String(item.horaInicio)}–{String(item.horaFim)} · {item.cliente ? String(item.cliente) : 'Interno'}
          </p>
        </div>
      ))}
    </Linhas>
  );
}

function TrocasPendentes({ dados }: { dados: unknown }) {
  const itens = comoLista(dados);
  if (itens.length === 0) return <Vazio texto="Nenhuma troca aguardando resposta" />;

  return (
    <Linhas>
      {itens.map((item) => (
        <div key={String(item.id)} className="px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              <span className="font-medium">{String(item.solicitante)}</span>
              <span className="text-ink-subtle"> ⇄ </span>
              <span className="font-medium">{String(item.destinatario)}</span>
            </p>
            <Badge tone="warn">{formatDateShort(String(item.data))}</Badge>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{String(item.motivo)}</p>
        </div>
      ))}
    </Linhas>
  );
}

function AusenciasPeriodo({ dados }: { dados: unknown }) {
  const itens = comoLista(dados);
  if (itens.length === 0) return <Vazio texto="Ninguém indisponível no período" />;

  return (
    <Linhas>
      {itens.map((item) => (
        <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{String(item.colaborador)}</p>
            <p className="text-xs capitalize text-ink-muted">{String(item.tipo)}</p>
          </div>
          <span className="tabular shrink-0 text-2xs text-ink-subtle">
            {formatDateShort(String(item.dataInicio))} – {formatDateShort(String(item.dataFim))}
          </span>
        </div>
      ))}
    </Linhas>
  );
}

function CoberturaSemana({ dados }: { dados: unknown }) {
  const itens = comoLista(dados) as Array<{ data: string; total: number }>;
  if (itens.length === 0) return <Vazio texto="Sem turnos no período" />;

  const maximo = Math.max(...itens.map((item) => item.total), 1);

  return (
    <div className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
      {itens.map((item) => (
        <div key={item.data}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-muted">
              {weekdayName(item.data, true)} {formatDateShort(item.data)}
            </span>
            <span className="tabular font-medium text-ink">{item.total}</span>
          </div>
          <Barra valor={item.total} maximo={maximo} />
        </div>
      ))}
    </div>
  );
}

function CargaPorColaborador({ dados }: { dados: unknown }) {
  const itens = comoLista(dados) as Array<{ colaborador: string; turnos: number; horas: number }>;
  if (itens.length === 0) return <Vazio texto="Sem turnos atribuídos no período" />;

  const maximo = Math.max(...itens.map((item) => item.turnos), 1);

  return (
    <div className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
      {itens.map((item) => (
        <div key={item.colaborador}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-ink">{item.colaborador}</span>
            <span className="tabular shrink-0 text-ink-muted">
              {item.turnos} turno{item.turnos === 1 ? '' : 's'} · {item.horas}h
            </span>
          </div>
          <Barra valor={item.turnos} maximo={maximo} />
        </div>
      ))}
    </div>
  );
}

function ClientesSla({ dados }: { dados: unknown }) {
  const itens = comoLista(dados);
  if (itens.length === 0) return <Vazio texto="Nenhum cliente vinculado" />;

  return (
    <Linhas>
      {itens.map((item) => (
        <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{String(item.nome)}</p>
            <p className="truncate text-xs text-ink-muted">{String(item.escalation)}</p>
          </div>
          {item.slaMinutos ? <Badge tone="accent">SLA {formatSla(Number(item.slaMinutos))}</Badge> : null}
        </div>
      ))}
    </Linhas>
  );
}

function Nota({ dados }: { dados: unknown }) {
  const texto = ((dados ?? {}) as { texto?: string }).texto ?? '';
  if (!texto.trim()) return <Vazio texto="Nota vazia" />;
  return <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-ink-muted sm:px-5">{texto}</p>;
}

/* ------------------------------------------------------------------ Card */

const ICONES: Record<string, typeof AlarmClock> = {
  metrica: CalendarClock,
  em_turno_agora: AlarmClock,
  proximos_turnos: CalendarClock,
  trocas_pendentes: Repeat2,
  ausencias_periodo: Plane,
  cobertura_semana: CalendarClock,
  carga_por_colaborador: CalendarClock,
  clientes_sla: Building2,
  nota: StickyNote,
};

function Corpo({ widget }: { widget: WidgetResult }) {
  const erro = (widget.dados as { erro?: string } | null)?.erro;
  if (erro) {
    return (
      <p className="flex items-center gap-2 px-4 py-6 text-xs text-warn sm:px-5">
        <TriangleAlert size={14} /> {erro}
      </p>
    );
  }

  switch (widget.tipo) {
    case 'metrica':
      return <Metrica dados={widget.dados} opcoes={widget.opcoes} titulo={widget.titulo} />;
    case 'em_turno_agora':
      return <EmTurnoAgora dados={widget.dados} />;
    case 'proximos_turnos':
      return <ProximosTurnos dados={widget.dados} />;
    case 'trocas_pendentes':
      return <TrocasPendentes dados={widget.dados} />;
    case 'ausencias_periodo':
      return <AusenciasPeriodo dados={widget.dados} />;
    case 'cobertura_semana':
      return <CoberturaSemana dados={widget.dados} />;
    case 'carga_por_colaborador':
      return <CargaPorColaborador dados={widget.dados} />;
    case 'clientes_sla':
      return <ClientesSla dados={widget.dados} />;
    case 'nota':
      return <Nota dados={widget.dados} />;
    default:
      return <Vazio texto="Widget desconhecido" />;
  }
}

export function WidgetCard({ widget, className }: { widget: WidgetResult; className?: string }) {
  const Icone = ICONES[widget.tipo] ?? CalendarClock;

  // O contador é compacto o suficiente para dispensar cabeçalho com ícone.
  if (widget.tipo === 'metrica') {
    return (
      <Card className={cx('relative overflow-hidden', className)}>
        <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden="true" />
        <div className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5">
          <p className="text-xs font-medium text-ink-muted">{widget.titulo}</p>
          <Icone size={16} className="text-ink-subtle" />
        </div>
        <Metrica dados={widget.dados} opcoes={widget.opcoes} titulo={widget.titulo} />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader title={widget.titulo} action={<Icone size={15} className="text-ink-subtle" />} />
      <Corpo widget={widget} />
    </Card>
  );
}
