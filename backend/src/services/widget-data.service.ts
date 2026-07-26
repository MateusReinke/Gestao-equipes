import { shiftRepository } from '../repositories/shift.repository';
import { swapRepository } from '../repositories/swap.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { absenceRepository } from '../repositories/absence.repository';
import { clientRepository } from '../repositories/client.repository';
import { teamRepository } from '../repositories/team.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { scaleRepository } from '../repositories/scale.repository';
import { addDays, dayBounds, formatDateOnly, isTimeBetween, toMinutes } from '../utils/date';
import { Widget } from '../types/widgets';

/**
 * Escopo de leitura de um dashboard.
 * `teamIds` é o recorte de equipes que o *observador* pode ver — por isso um
 * dashboard compartilhado mostra números diferentes para pessoas diferentes:
 * compartilhar o painel dá acesso ao layout, nunca a dados que a pessoa não
 * poderia consultar por conta própria. O wallboard público é a exceção
 * consciente: o dono do dashboard abriu o link, então o escopo é o tenant todo.
 */
export type WidgetScope = {
  tenantId: number;
  teamIds: number[];
};

export type WidgetResult = {
  id: string;
  tipo: Widget['tipo'];
  titulo: string;
  largura: number;
  /** a própria declaração do widget, devolvida para o frontend rotular o resultado */
  opcoes: Widget['opcoes'];
  dados: unknown;
};

function limite(widget: Widget, padrao: number) {
  return widget.opcoes.limite ?? padrao;
}

function dias(widget: Widget, padrao: number) {
  return widget.opcoes.dias ?? padrao;
}

/// Aplica o filtro de equipe do widget sobre o escopo do observador.
/// Uma equipe fora do escopo não amplia nada: o resultado vira vazio.
function equipesDoWidget(widget: Widget, scope: WidgetScope): number[] {
  const filtro = widget.opcoes.equipeId;
  if (filtro == null) return scope.teamIds;
  return scope.teamIds.includes(filtro) ? [filtro] : [];
}

async function resolveMetrica(widget: Widget, scope: WidgetScope, teamIds: number[]) {
  const metrica = widget.opcoes.metrica ?? 'colaboradores';
  const { start, end } = dayBounds();

  switch (metrica) {
    case 'clientes': {
      const clientes = await clientRepository.findByTeamIds(scope.tenantId, teamIds);
      return { valor: clientes.length, unidade: 'clientes' };
    }
    case 'equipes': {
      const equipes = await teamRepository.countByIds(scope.tenantId, teamIds);
      return { valor: equipes.length, unidade: 'equipes' };
    }
    case 'colaboradores': {
      const pessoas = await collaboratorRepository.findActiveByTeamIds(scope.tenantId, teamIds);
      return { valor: pessoas.length, unidade: 'ativos' };
    }
    case 'em_turno_agora': {
      const turnos = await turnosAgora(scope.tenantId, teamIds);
      return { valor: turnos.length, unidade: 'em turno' };
    }
    case 'ferias_hoje': {
      const ferias = await vacationRepository.findApprovedInRangeForTeams(scope.tenantId, teamIds, start, start);
      return { valor: ferias.length, unidade: 'de férias' };
    }
    case 'trocas_pendentes': {
      const trocas = await swapRepository.list(scope.tenantId, { status: 'pendente', teamIds });
      return { valor: trocas.length, unidade: 'pendentes' };
    }
    case 'escalas_ativas': {
      const escalas = await scaleRepository.findByTeamIds(scope.tenantId, teamIds);
      return { valor: escalas.length, unidade: 'escalas' };
    }
    case 'turnos_7_dias': {
      const turnos = await shiftRepository.findByRange({
        tenantId: scope.tenantId,
        inicio: start,
        fim: addDays(start, 7),
        teamIds,
      });
      return { valor: turnos.length, unidade: 'turnos' };
    }
    default:
      return { valor: 0, unidade: '' };
  }
}

/// Turnos que estão acontecendo neste instante, descontando quem está de
/// férias ou ausente — mesma regra do "em turno agora" do painel principal.
async function turnosAgora(tenantId: number, teamIds: number[]) {
  if (teamIds.length === 0) return [];
  const agora = new Date();
  const { start, end } = dayBounds(agora);

  const [ferias, ausencias] = await Promise.all([
    vacationRepository.findApprovedOverlapping(tenantId, start, start),
    absenceRepository.findApprovedOverlapping(tenantId, start, start),
  ]);

  const indisponiveis = [
    ...ferias.map((item) => item.colaboradorId),
    ...ausencias.map((item) => item.colaboradorId),
  ];

  const turnos = await shiftRepository.findForDay({
    tenantId,
    inicio: start,
    fim: end,
    teamIds,
    excludeCollaboratorIds: indisponiveis,
  });

  const minutosAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  return turnos.filter((turno) => isTimeBetween(minutosAgora, turno.horaInicio, turno.horaFim));
}

async function resolveWidget(widget: Widget, scope: WidgetScope): Promise<unknown> {
  const teamIds = equipesDoWidget(widget, scope);
  const { start } = dayBounds();

  if (widget.tipo === 'nota') {
    return { texto: widget.opcoes.texto ?? '' };
  }

  if (teamIds.length === 0) return widget.tipo === 'metrica' ? { valor: 0, unidade: '' } : [];

  switch (widget.tipo) {
    case 'metrica':
      return resolveMetrica(widget, scope, teamIds);

    case 'em_turno_agora': {
      const turnos = await turnosAgora(scope.tenantId, teamIds);
      return turnos.slice(0, limite(widget, 10)).map((turno) => ({
        id: turno.id,
        colaborador: turno.colaborador.nome,
        equipe: turno.colaborador.equipe?.nome ?? null,
        cliente: turno.cliente?.nome ?? null,
        horaInicio: turno.horaInicio,
        horaFim: turno.horaFim,
        status: turno.status,
        colaboradorOriginal: turno.colaboradorOriginal?.nome ?? null,
      }));
    }

    case 'proximos_turnos': {
      const turnos = await shiftRepository.findUpcoming({
        tenantId: scope.tenantId,
        inicio: start,
        teamIds,
        take: limite(widget, 8),
      });
      return turnos.map((turno) => ({
        id: turno.id,
        data: formatDateOnly(turno.data),
        colaborador: turno.colaborador.nome,
        cliente: turno.cliente?.nome ?? null,
        horaInicio: turno.horaInicio,
        horaFim: turno.horaFim,
      }));
    }

    case 'trocas_pendentes': {
      const trocas = await swapRepository.list(scope.tenantId, { status: 'pendente', teamIds });
      return trocas.slice(0, limite(widget, 8)).map((troca) => ({
        id: troca.id,
        tipo: troca.tipo,
        solicitante: troca.solicitante.nome,
        destinatario: troca.destinatario.nome,
        data: formatDateOnly(troca.turnoOrigem.data),
        motivo: troca.motivo,
      }));
    }

    case 'ausencias_periodo': {
      const fim = addDays(start, dias(widget, 30));
      const [ferias, ausencias] = await Promise.all([
        vacationRepository.findApprovedInRangeForTeams(scope.tenantId, teamIds, start, fim),
        absenceRepository.findByTeamIds(scope.tenantId, teamIds),
      ]);

      const itens = [
        ...ferias.map((item) => ({
          id: `ferias-${item.id}`,
          tipo: 'férias',
          colaborador: item.colaborador.nome,
          dataInicio: formatDateOnly(item.dataInicio),
          dataFim: formatDateOnly(item.dataFim),
        })),
        ...ausencias
          .filter(
            (item) =>
              item.status === 'aprovado' && item.dataFim >= start && item.dataInicio <= fim
          )
          .map((item) => ({
            id: `ausencia-${item.id}`,
            tipo: item.tipo,
            colaborador: item.colaborador.nome,
            dataInicio: formatDateOnly(item.dataInicio),
            dataFim: formatDateOnly(item.dataFim),
          })),
      ];

      itens.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
      return itens.slice(0, limite(widget, 12));
    }

    case 'cobertura_semana': {
      const janela = dias(widget, 7);
      const fim = addDays(start, janela - 1);
      const turnos = await shiftRepository.findByRange({
        tenantId: scope.tenantId,
        inicio: start,
        fim,
        teamIds,
      });

      const porDia = new Map<string, number>();
      for (let i = 0; i < janela; i += 1) porDia.set(formatDateOnly(addDays(start, i)), 0);
      for (const turno of turnos) {
        const chave = formatDateOnly(turno.data);
        if (porDia.has(chave)) porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
      }

      return [...porDia.entries()].map(([data, total]) => ({ data, total }));
    }

    case 'carga_por_colaborador': {
      const janela = dias(widget, 30);
      const turnos = await shiftRepository.findByRange({
        tenantId: scope.tenantId,
        inicio: start,
        fim: addDays(start, janela - 1),
        teamIds,
      });

      const acumulado = new Map<number, { colaborador: string; turnos: number; horas: number }>();
      for (const turno of turnos) {
        const atual = acumulado.get(turno.colaboradorId) ?? {
          colaborador: turno.colaborador.nome,
          turnos: 0,
          horas: 0,
        };
        const inicio = toMinutes(turno.horaInicio);
        const fim = toMinutes(turno.horaFim);
        // Turno que vira a meia-noite (19:00 -> 07:00) dura o resto do dia + o começo do seguinte.
        const duracao = fim > inicio ? fim - inicio : 24 * 60 - inicio + fim;
        acumulado.set(turno.colaboradorId, {
          colaborador: atual.colaborador,
          turnos: atual.turnos + 1,
          horas: atual.horas + duracao / 60,
        });
      }

      return [...acumulado.values()]
        .map((item) => ({ ...item, horas: Math.round(item.horas * 10) / 10 }))
        .sort((a, b) => b.turnos - a.turnos)
        .slice(0, limite(widget, 10));
    }

    case 'clientes_sla': {
      const clientes = await clientRepository.findByTeamIds(scope.tenantId, teamIds);
      return clientes.slice(0, limite(widget, 10)).map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        escalation: cliente.escalation,
        slaMinutos: cliente.slaMinutos,
        responsavel: cliente.responsavelInterno?.nome ?? null,
      }));
    }

    default:
      return null;
  }
}

/**
 * Resolve todos os widgets de um layout. Um widget que falhar não derruba o
 * painel inteiro: ele volta com `erro` e os demais continuam renderizando.
 */
export async function resolveWidgets(widgets: Widget[], scope: WidgetScope): Promise<WidgetResult[]> {
  return Promise.all(
    widgets.map(async (widget) => {
      try {
        return {
          id: widget.id,
          tipo: widget.tipo,
          titulo: widget.titulo,
          largura: widget.largura,
          opcoes: widget.opcoes,
          dados: await resolveWidget(widget, scope),
        };
      } catch (error) {
        console.error(`[widget] falha ao resolver "${widget.tipo}"`, error);
        return {
          id: widget.id,
          tipo: widget.tipo,
          titulo: widget.titulo,
          largura: widget.largura,
          opcoes: widget.opcoes,
          dados: { erro: 'Não foi possível carregar este widget' },
        };
      }
    })
  );
}
