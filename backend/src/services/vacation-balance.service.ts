import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { PERMISSIONS } from '../types/permissions';
import { hrRepository, notificationRepository } from '../repositories/hr.repository';
import { getVisibleTeamIds } from './scope.service';
import { eachDay, toDateOnly } from '../utils/date';
import { Ciclo, calcularCiclos } from './vacation-cycle.service';
import { AlertaFerias, avaliarCiclos, ordenarPorUrgencia } from './vacation-alert.service';

export class NoActiveTenantError extends Error {}
export class CollaboratorNotFoundError extends Error {}

export const ajusteSchema = z.object({
  colaboradorId: z.coerce.number().int().positive(),
  cicloNumero: z.coerce.number().int().positive(),
  diasDelta: z.coerce.number().int().refine((valor) => valor !== 0, 'O ajuste precisa somar ou subtrair dias'),
  motivo: z.string().trim().min(5, 'Descreva o motivo do ajuste'),
});

export type AjusteInput = z.infer<typeof ajusteSchema>;

export type SaldoColaborador = {
  colaboradorId: number;
  nome: string;
  equipe: { id: number; nome: string } | null;
  tipoContrato: string;
  ativo: boolean;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  /** null quando falta a data de admissão — sem ela não há ciclo a calcular */
  ciclos: Array<Omit<Ciclo, 'inicio' | 'fim' | 'limiteConcessivo'> & {
    inicio: string;
    fim: string;
    limiteConcessivo: string;
  }> | null;
  diasEmAberto: number;
  alertas: AlertaFerias[];
};

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

const iso = (data: Date) => toDateOnly(data).toISOString().slice(0, 10);

/**
 * Saldo de férias de todas as pessoas que o usuário enxerga.
 *
 * Os ciclos são derivados aqui, na leitura — não existem no banco. Por isso o
 * resultado está sempre correto mesmo que uma falta seja lançada com atraso ou
 * a data de admissão seja corrigida depois.
 */
export async function listarSaldos(user?: JwtPayload, hoje = new Date()): Promise<SaldoColaborador[]> {
  const tenantId = requireTenant(user);
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];

  const base = await hrRepository.carregarBaseDeFerias(tenantId, teamIds);

  // Uma ausência do tipo falta cobre um intervalo; a CLT conta dias, então
  // cada dia do intervalo vira uma falta.
  const faltasPorColaborador = new Map<number, Date[]>();
  for (const falta of base.faltas) {
    const dias = eachDay(falta.dataInicio, falta.dataFim);
    faltasPorColaborador.set(falta.colaboradorId, [...(faltasPorColaborador.get(falta.colaboradorId) ?? []), ...dias]);
  }

  return base.colaboradores.map((colaborador) => {
    const comum = {
      colaboradorId: colaborador.id,
      nome: colaborador.nome,
      equipe: colaborador.equipe,
      tipoContrato: colaborador.tipoContrato,
      ativo: colaborador.ativo,
      dataAdmissao: colaborador.dataAdmissao ? iso(colaborador.dataAdmissao) : null,
      dataDesligamento: colaborador.dataDesligamento ? iso(colaborador.dataDesligamento) : null,
    };

    if (!colaborador.dataAdmissao) {
      return { ...comum, ciclos: null, diasEmAberto: 0, alertas: [] };
    }

    const ciclos = calcularCiclos({
      dataAdmissao: colaborador.dataAdmissao,
      dataDesligamento: colaborador.dataDesligamento,
      faltas: faltasPorColaborador.get(colaborador.id) ?? [],
      feriasGozadas: base.ferias
        .filter((item) => item.colaboradorId === colaborador.id)
        .map((item) => ({
          cicloNumero: item.cicloNumero,
          dataInicio: item.dataInicio,
          dataFim: item.dataFim,
          diasAbono: item.diasAbono,
        })),
      ajustes: base.ajustes
        .filter((item) => item.colaboradorId === colaborador.id)
        .map((item) => ({ cicloNumero: item.cicloNumero, diasDelta: item.diasDelta, motivo: item.motivo })),
      hoje,
    });

    const alertas = avaliarCiclos({
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      ciclos,
    });

    return {
      ...comum,
      ciclos: ciclos.map((ciclo) => ({
        ...ciclo,
        inicio: iso(ciclo.inicio),
        fim: iso(ciclo.fim),
        limiteConcessivo: iso(ciclo.limiteConcessivo),
      })),
      diasEmAberto: ciclos.reduce((soma, ciclo) => soma + (ciclo.status === 'em_curso' ? 0 : ciclo.diasSaldo), 0),
      alertas,
    };
  });
}

/// Só quem tem algo a resolver, do mais urgente para o menos.
export async function listarAlertas(user?: JwtPayload, hoje = new Date()) {
  const saldos = await listarSaldos(user, hoje);

  const alertas = saldos.flatMap((saldo) =>
    saldo.alertas.map((alerta) => ({
      ...alerta,
      colaboradorId: saldo.colaboradorId,
      colaboradorNome: saldo.nome,
      equipe: saldo.equipe?.nome ?? null,
      limiteConcessivo: iso(alerta.limiteConcessivo),
    }))
  );

  // Cadastro sem admissão não gera alerta de prazo, mas é um problema por si:
  // enquanto faltar a data, essa pessoa fica fora de todo o controle de férias.
  const semAdmissao = saldos.filter((saldo) => saldo.ciclos === null);

  return { alertas: ordenarPorUrgencia(alertas), semAdmissao };
}

export async function registrarAjuste(data: AjusteInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const teamIds = await getVisibleTeamIds(user);

  const base = await hrRepository.carregarBaseDeFerias(tenantId, teamIds);
  const colaborador = base.colaboradores.find((item) => item.id === data.colaboradorId);
  if (!colaborador) throw new CollaboratorNotFoundError('Colaborador não encontrado entre os que você gerencia');

  return hrRepository.criarAjuste({
    tenantId,
    colaboradorId: data.colaboradorId,
    cicloNumero: data.cicloNumero,
    diasDelta: data.diasDelta,
    motivo: data.motivo,
    registradoPorId: user?.userId ?? null,
  });
}

/**
 * Varredura que transforma alertas em notificações.
 *
 * Idempotente por construção: a chave identifica o fato (colaborador + ciclo +
 * severidade), então rodar duas vezes no mesmo dia — ou em duas instâncias —
 * não duplica nada.
 *
 * Destinatários, em dois alcances distintos:
 *
 * - **Responsáveis pela equipe** (`gestor_equipes`) recebem o que é da equipe
 *   deles. É o alcance que lhes cabe, e o que mantém o alerta acionável.
 * - **RH** (`hr.vacation.watch_all`) recebe de todo mundo, porque acompanhar o
 *   passivo de férias da empresa é justamente a função.
 *
 * Ninguém mais é varrido: alerta que chega a quem não pode agir vira ruído, e
 * ruído faz o próximo alerta de verdade passar batido.
 */
export async function varrerAlertasDeFerias(params: {
  tenantId: number;
  teamIds: number[];
  hoje?: Date;
}): Promise<{ alertas: number; notificacoes: number }> {
  const hoje = params.hoje ?? new Date();
  const base = await hrRepository.carregarBaseDeFerias(params.tenantId, params.teamIds);
  if (base.colaboradores.length === 0) return { alertas: 0, notificacoes: 0 };

  const faltasPorColaborador = new Map<number, Date[]>();
  for (const falta of base.faltas) {
    const dias = eachDay(falta.dataInicio, falta.dataFim);
    faltasPorColaborador.set(falta.colaboradorId, [...(faltasPorColaborador.get(falta.colaboradorId) ?? []), ...dias]);
  }

  const [gestores, rh] = await Promise.all([
    notificationRepository.gestoresDasEquipes(params.tenantId, params.teamIds),
    notificationRepository.usuariosComPermissao(params.tenantId, PERMISSIONS.HR_VACATION_WATCH_ALL),
  ]);

  const gestoresPorEquipe = new Map<number, number[]>();
  for (const item of gestores) {
    gestoresPorEquipe.set(item.equipeId, [...(gestoresPorEquipe.get(item.equipeId) ?? []), item.gestorId]);
  }

  const aEmitir: Parameters<typeof notificationRepository.emitirEmLote>[0] = [];
  let totalAlertas = 0;

  for (const colaborador of base.colaboradores) {
    if (!colaborador.dataAdmissao) continue;

    const ciclos = calcularCiclos({
      dataAdmissao: colaborador.dataAdmissao,
      dataDesligamento: colaborador.dataDesligamento,
      faltas: faltasPorColaborador.get(colaborador.id) ?? [],
      feriasGozadas: base.ferias
        .filter((item) => item.colaboradorId === colaborador.id)
        .map((item) => ({
          cicloNumero: item.cicloNumero,
          dataInicio: item.dataInicio,
          dataFim: item.dataFim,
          diasAbono: item.diasAbono,
        })),
      ajustes: base.ajustes
        .filter((item) => item.colaboradorId === colaborador.id)
        .map((item) => ({ cicloNumero: item.cicloNumero, diasDelta: item.diasDelta, motivo: item.motivo })),
      hoje,
    });

    const alertas = avaliarCiclos({
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      ciclos,
    });
    totalAlertas += alertas.length;

    // O Set faz o trabalho de quem é as duas coisas: um responsável de equipe
    // que também é RH recebe uma notificação, não duas.
    const destinatarios = new Set([...(gestoresPorEquipe.get(colaborador.equipe?.id ?? -1) ?? []), ...rh]);
    for (const alerta of alertas) {
      for (const destinatarioId of destinatarios) {
        aEmitir.push({
          tenantId: params.tenantId,
          destinatarioId,
          tipo: alerta.tipo,
          severidade: alerta.severidade,
          titulo: alerta.titulo,
          mensagem: alerta.mensagem,
          link: '/rh/ferias',
          entidade: 'colaborador',
          entidadeId: String(colaborador.id),
          chaveIdempotencia: alerta.chaveIdempotencia,
        });
      }
    }
  }

  const resultado = await notificationRepository.emitirEmLote(aEmitir);
  return { alertas: totalAlertas, notificacoes: resultado.count };
}
