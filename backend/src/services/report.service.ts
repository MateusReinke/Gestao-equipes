import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { shiftRepository } from '../repositories/shift.repository';
import { swapRepository } from '../repositories/swap.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { absenceRepository } from '../repositories/absence.repository';
import { getVisibleTeamIds } from './scope.service';
import { addDays, diffInDays, formatDateOnly, toDateOnly, toMinutes } from '../utils/date';

export class NoActiveTenantError extends Error {}
export class UnknownReportError extends Error {}

export const REPORTS = [
  {
    id: 'escala-colaborador',
    nome: 'Escala por colaborador',
    descricao: 'Turnos de cada pessoa no período, com trocas destacadas.',
  },
  {
    id: 'escala-equipe',
    nome: 'Escala por equipe',
    descricao: 'Cobertura consolidada por time, dia a dia.',
  },
  {
    id: 'horas-turno',
    nome: 'Horas por colaborador',
    descricao: 'Turnos, horas acumuladas e média por turno no período.',
  },
  {
    id: 'trocas',
    nome: 'Trocas de turno',
    descricao: 'Histórico de pedidos, aceites, aprovações e recusas.',
  },
  {
    id: 'ausencias',
    nome: 'Férias e ausências',
    descricao: 'Indisponibilidades do período, com status de aprovação.',
  },
] as const;

export type ReportId = (typeof REPORTS)[number]['id'];

export const reportQuerySchema = z.object({
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
  equipeId: z.coerce.number().int().positive().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/// `formato: 'data'` diz à tela para exibir dd/mm/aaaa. O CSV mantém o ISO:
/// é o que ordena corretamente como texto e o que qualquer planilha importa
/// sem ambiguidade entre dia e mês.
export type Coluna = { chave: string; titulo: string; numerico?: boolean; formato?: 'data' };
export type Linha = Record<string, string | number | null>;
export type Relatorio = { id: string; nome: string; colunas: Coluna[]; linhas: Linha[] };

/// As colunas ficam fora dos geradores para que a tela monte o cabeçalho da
/// tabela mesmo quando não há nada a consultar.
const COLUNAS: Record<ReportId, Coluna[]> = {
  'escala-colaborador': [
    { chave: 'colaborador', titulo: 'Colaborador' },
    { chave: 'equipe', titulo: 'Equipe' },
    { chave: 'data', titulo: 'Data', formato: 'data' },
    { chave: 'diaSemana', titulo: 'Dia da semana' },
    { chave: 'horaInicio', titulo: 'Início' },
    { chave: 'horaFim', titulo: 'Fim' },
    { chave: 'horas', titulo: 'Horas', numerico: true },
    { chave: 'tipo', titulo: 'Tipo' },
    { chave: 'cliente', titulo: 'Cliente' },
    { chave: 'status', titulo: 'Status' },
    { chave: 'escaladoOriginalmente', titulo: 'Escalado originalmente' },
  ],
  'escala-equipe': [
    { chave: 'equipe', titulo: 'Equipe' },
    { chave: 'data', titulo: 'Data', formato: 'data' },
    { chave: 'diaSemana', titulo: 'Dia da semana' },
    { chave: 'turnos', titulo: 'Turnos', numerico: true },
    { chave: 'pessoas', titulo: 'Pessoas', numerico: true },
    { chave: 'horas', titulo: 'Horas', numerico: true },
    { chave: 'colaboradores', titulo: 'Colaboradores' },
  ],
  'horas-turno': [
    { chave: 'colaborador', titulo: 'Colaborador' },
    { chave: 'equipe', titulo: 'Equipe' },
    { chave: 'turnos', titulo: 'Turnos', numerico: true },
    { chave: 'diasTrabalhados', titulo: 'Dias com turno', numerico: true },
    { chave: 'horas', titulo: 'Horas', numerico: true },
    { chave: 'mediaPorTurno', titulo: 'Média por turno (h)', numerico: true },
  ],
  trocas: [
    { chave: 'solicitadoEm', titulo: 'Solicitado em', formato: 'data' },
    { chave: 'tipo', titulo: 'Tipo' },
    { chave: 'solicitante', titulo: 'Solicitante' },
    { chave: 'destinatario', titulo: 'Destinatário' },
    { chave: 'diaOrigem', titulo: 'Dia cedido', formato: 'data' },
    { chave: 'diaDestino', titulo: 'Dia recebido', formato: 'data' },
    { chave: 'motivo', titulo: 'Motivo' },
    { chave: 'status', titulo: 'Status' },
    { chave: 'respondidoPor', titulo: 'Respondido por' },
    { chave: 'respondidoEm', titulo: 'Respondido em', formato: 'data' },
  ],
  ausencias: [
    { chave: 'colaborador', titulo: 'Colaborador' },
    { chave: 'equipe', titulo: 'Equipe' },
    { chave: 'tipo', titulo: 'Tipo' },
    { chave: 'dataInicio', titulo: 'Início', formato: 'data' },
    { chave: 'dataFim', titulo: 'Fim', formato: 'data' },
    { chave: 'dias', titulo: 'Dias', numerico: true },
    { chave: 'status', titulo: 'Status' },
    { chave: 'motivo', titulo: 'Motivo' },
    { chave: 'respondidoPor', titulo: 'Respondido por' },
  ],
};

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function metaDe(id: string) {
  const meta = REPORTS.find((item) => item.id === id);
  if (!meta) throw new UnknownReportError('Relatório desconhecido');
  return meta;
}

function diaSemana(data: Date) {
  return DIAS[toDateOnly(data).getUTCDay()];
}

/// Duração em horas, tratando o turno que atravessa a meia-noite (19:00 -> 07:00).
function duracaoHoras(horaInicio: string, horaFim: string) {
  const inicio = toMinutes(horaInicio);
  const fim = toMinutes(horaFim);
  const minutos = fim > inicio ? fim - inicio : 24 * 60 - inicio + fim;
  return minutos / 60;
}

function arredonda(valor: number) {
  return Math.round(valor * 10) / 10;
}

const STATUS_TROCA: Record<string, string> = {
  pendente: 'Aguardando o colega',
  aceito_pelo_par: 'Aguardando aprovação',
  aprovado: 'Aprovada',
  rejeitado: 'Recusada',
  cancelado: 'Cancelada',
};

/// O relatório é lido por pessoas — os enums do banco viram texto legível aqui,
/// e não na tela, para que o CSV saia do mesmo jeito.
const TIPO_TURNO: Record<string, string> = {
  turno: 'Turno',
  plantao: 'Plantão',
  sobreaviso: 'Sobreaviso',
};

const STATUS_TURNO: Record<string, string> = {
  planejado: 'Planejado',
  confirmado: 'Confirmado',
  trocado: 'Trocado',
  cancelado: 'Cancelado',
};

const STATUS_APROVACAO: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
};

const TIPO_AUSENCIA: Record<string, string> = {
  falta: 'Falta',
  atestado: 'Atestado',
  licenca: 'Licença',
  folga: 'Folga',
  banco_horas: 'Banco de horas',
  outro: 'Outro',
};

/**
 * Recorte do relatório: as equipes que o usuário enxerga, opcionalmente
 * estreitado pelo filtro. Uma equipe fora do escopo não amplia nada —
 * o relatório sai vazio em vez de vazar dado de outro time.
 */
async function escopo(user: JwtPayload | undefined, equipeId?: number) {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  const visiveis = await getVisibleTeamIds(user);
  const teamIds = equipeId != null ? (visiveis.includes(equipeId) ? [equipeId] : []) : visiveis;
  return { tenantId: user.activeTenantId, teamIds };
}

async function escalaPorColaborador(tenantId: number, teamIds: number[], query: ReportQuery): Promise<Linha[]> {
  const turnos = await shiftRepository.findByRange({ tenantId, inicio: query.inicio, fim: query.fim, teamIds });

  return turnos
    .map((turno) => ({
      colaborador: turno.colaborador.nome,
      equipe: turno.colaborador.equipe?.nome ?? '',
      data: formatDateOnly(turno.data),
      diaSemana: diaSemana(turno.data),
      horaInicio: turno.horaInicio,
      horaFim: turno.horaFim,
      horas: arredonda(duracaoHoras(turno.horaInicio, turno.horaFim)),
      tipo: TIPO_TURNO[turno.tipo] ?? turno.tipo,
      cliente: turno.cliente?.nome ?? '',
      status: STATUS_TURNO[turno.status] ?? turno.status,
      // Só é preenchido quando o turno mudou de dono por uma troca aprovada.
      escaladoOriginalmente: turno.colaboradorOriginal?.nome ?? '',
    }))
    .sort((a, b) => a.colaborador.localeCompare(b.colaborador) || a.data.localeCompare(b.data));
}

async function escalaPorEquipe(tenantId: number, teamIds: number[], query: ReportQuery): Promise<Linha[]> {
  const turnos = await shiftRepository.findByRange({ tenantId, inicio: query.inicio, fim: query.fim, teamIds });

  // Agrega por (equipe, dia): quantos turnos, quantas pessoas distintas, quantas horas.
  const grupos = new Map<string, { equipe: string; data: string; turnos: number; pessoas: Set<string>; horas: number }>();

  for (const turno of turnos) {
    const equipe = turno.colaborador.equipe?.nome ?? 'Sem equipe';
    const data = formatDateOnly(turno.data);
    const chave = `${equipe}|${data}`;
    const grupo = grupos.get(chave) ?? { equipe, data, turnos: 0, pessoas: new Set<string>(), horas: 0 };
    grupo.turnos += 1;
    grupo.pessoas.add(turno.colaborador.nome);
    grupo.horas += duracaoHoras(turno.horaInicio, turno.horaFim);
    grupos.set(chave, grupo);
  }

  return [...grupos.values()]
    .map((grupo) => ({
      equipe: grupo.equipe,
      data: grupo.data,
      diaSemana: diaSemana(new Date(`${grupo.data}T00:00:00Z`)),
      turnos: grupo.turnos,
      pessoas: grupo.pessoas.size,
      horas: arredonda(grupo.horas),
      colaboradores: [...grupo.pessoas].sort().join(', '),
    }))
    .sort((a, b) => a.equipe.localeCompare(b.equipe) || a.data.localeCompare(b.data));
}

async function horasPorColaborador(tenantId: number, teamIds: number[], query: ReportQuery): Promise<Linha[]> {
  const turnos = await shiftRepository.findByRange({ tenantId, inicio: query.inicio, fim: query.fim, teamIds });

  const acumulado = new Map<
    number,
    { colaborador: string; equipe: string; turnos: number; horas: number; dias: Set<string> }
  >();

  for (const turno of turnos) {
    const atual = acumulado.get(turno.colaboradorId) ?? {
      colaborador: turno.colaborador.nome,
      equipe: turno.colaborador.equipe?.nome ?? '',
      turnos: 0,
      horas: 0,
      dias: new Set<string>(),
    };
    atual.turnos += 1;
    atual.horas += duracaoHoras(turno.horaInicio, turno.horaFim);
    atual.dias.add(formatDateOnly(turno.data));
    acumulado.set(turno.colaboradorId, atual);
  }

  return [...acumulado.values()]
    .map((item) => ({
      colaborador: item.colaborador,
      equipe: item.equipe,
      turnos: item.turnos,
      diasTrabalhados: item.dias.size,
      horas: arredonda(item.horas),
      mediaPorTurno: arredonda(item.horas / item.turnos),
    }))
    .sort((a, b) => b.horas - a.horas);
}

async function relatorioTrocas(tenantId: number, teamIds: number[], query: ReportQuery): Promise<Linha[]> {
  const trocas = await swapRepository.list(tenantId, { teamIds });
  const inicio = toDateOnly(query.inicio);
  const fim = toDateOnly(query.fim);

  return trocas
    // O período filtra pelo dia do turno cedido — é o que o gestor procura ao
    // perguntar "quais trocas aconteceram neste mês de escala?".
    .filter((troca) => {
      const dia = toDateOnly(troca.turnoOrigem.data);
      return dia >= inicio && dia <= fim;
    })
    .map((troca) => ({
      solicitadoEm: formatDateOnly(troca.createdAt),
      tipo: troca.tipo === 'cobertura' ? 'Cobertura' : 'Troca mútua',
      solicitante: troca.solicitante.nome,
      destinatario: troca.destinatario.nome,
      diaOrigem: formatDateOnly(troca.turnoOrigem.data),
      diaDestino: troca.turnoDestino ? formatDateOnly(troca.turnoDestino.data) : '',
      motivo: troca.motivo,
      status: STATUS_TROCA[troca.status] ?? troca.status,
      respondidoPor: troca.respondidoPor?.nome ?? '',
      respondidoEm: troca.respondidoEm ? formatDateOnly(troca.respondidoEm) : '',
    }))
    .sort((a, b) => a.diaOrigem.localeCompare(b.diaOrigem));
}

async function relatorioAusencias(tenantId: number, teamIds: number[], query: ReportQuery): Promise<Linha[]> {
  const [ferias, ausencias] = await Promise.all([
    vacationRepository.findByTeamIds(tenantId, teamIds),
    absenceRepository.findByTeamIds(tenantId, teamIds),
  ]);

  const inicio = toDateOnly(query.inicio);
  const fim = toDateOnly(query.fim);
  const cruzaPeriodo = (de: Date, ate: Date) => toDateOnly(ate) >= inicio && toDateOnly(de) <= fim;

  const linhas: Linha[] = [
    ...ferias
      .filter((item) => cruzaPeriodo(item.dataInicio, item.dataFim))
      .map((item) => ({
        colaborador: item.colaborador.nome,
        equipe: item.colaborador.equipe?.nome ?? '',
        tipo: 'Férias',
        dataInicio: formatDateOnly(item.dataInicio),
        dataFim: formatDateOnly(item.dataFim),
        dias: diffInDays(item.dataInicio, item.dataFim) + 1,
        status: STATUS_APROVACAO[item.status] ?? item.status,
        motivo: item.observacao ?? '',
        respondidoPor: item.respondidoPor?.nome ?? '',
      })),
    ...ausencias
      .filter((item) => cruzaPeriodo(item.dataInicio, item.dataFim))
      .map((item) => ({
        colaborador: item.colaborador.nome,
        equipe: item.colaborador.equipe?.nome ?? '',
        tipo: TIPO_AUSENCIA[item.tipo] ?? item.tipo,
        dataInicio: formatDateOnly(item.dataInicio),
        dataFim: formatDateOnly(item.dataFim),
        dias: diffInDays(item.dataInicio, item.dataFim) + 1,
        status: STATUS_APROVACAO[item.status] ?? item.status,
        motivo: item.motivo ?? '',
        respondidoPor: item.respondidoPor?.nome ?? '',
      })),
  ];

  return linhas.sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio)));
}

const GERADORES: Record<ReportId, (tenantId: number, teamIds: number[], query: ReportQuery) => Promise<Linha[]>> = {
  'escala-colaborador': escalaPorColaborador,
  'escala-equipe': escalaPorEquipe,
  'horas-turno': horasPorColaborador,
  trocas: relatorioTrocas,
  ausencias: relatorioAusencias,
};

export async function gerarRelatorio(id: string, query: ReportQuery, user?: JwtPayload): Promise<Relatorio> {
  const meta = metaDe(id);
  const { tenantId, teamIds } = await escopo(user, query.equipeId);
  const colunas = COLUNAS[meta.id];

  // Sem equipe no escopo não há o que consultar: devolve só a estrutura, em vez
  // de disparar uma query que traria o tenant inteiro.
  if (teamIds.length === 0) return { id: meta.id, nome: meta.nome, colunas, linhas: [] };

  const linhas = await GERADORES[meta.id](tenantId, teamIds, query);
  return { id: meta.id, nome: meta.nome, colunas, linhas };
}

/**
 * Serializa em CSV para Excel em pt-BR: separador `;`, decimal com vírgula e
 * BOM UTF-8 no início — sem o BOM o Excel abre a acentuação quebrada.
 */
export function toCsv(relatorio: Relatorio): string {
  const escapa = (valor: string | number | null) => {
    if (valor == null) return '';
    if (typeof valor === 'number') return String(valor).replace('.', ',');
    // Aspas duplas dentro do campo dobram; campo com separador ou quebra vai entre aspas.
    const texto = valor.replace(/"/g, '""');
    return /[;"\n\r]/.test(texto) ? `"${texto}"` : texto;
  };

  const cabecalho = relatorio.colunas.map((coluna) => escapa(coluna.titulo)).join(';');
  const linhas = relatorio.linhas.map((linha) =>
    relatorio.colunas.map((coluna) => escapa(linha[coluna.chave] ?? '')).join(';')
  );

  return `﻿${[cabecalho, ...linhas].join('\r\n')}\r\n`;
}

/// Nome de arquivo previsível e ordenável: relatorio_inicio_a_fim.csv
export function nomeArquivo(relatorio: Relatorio, query: ReportQuery) {
  return `${relatorio.id}_${formatDateOnly(query.inicio)}_a_${formatDateOnly(query.fim)}.csv`;
}

/// Período sugerido pela tela: o mês corrente.
export function periodoPadrao() {
  const hoje = toDateOnly(new Date());
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fim = addDays(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1)), -1);
  return { inicio: formatDateOnly(inicio), fim: formatDateOnly(fim) };
}
