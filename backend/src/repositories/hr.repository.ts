import { NotificationSeverity, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/// Contratos que geram direito a férias com esta empresa (ver vacation-cycle.service).
const CONTRATOS_COM_FERIAS: Prisma.EnumContractTypeFilter = { in: ['clt', 'estagio'] };

export const hrRepository = {
  /**
   * Tudo o que o cálculo de ciclos precisa, em uma consulta por tabela.
   * Buscar por colaborador seria N+1 numa operação com dezenas de pessoas.
   */
  async carregarBaseDeFerias(tenantId: number, teamIds: number[]) {
    const colaboradores = await prisma.collaborator.findMany({
      where: {
        tenantId,
        equipeId: { in: teamIds },
        tipoContrato: CONTRATOS_COM_FERIAS,
        // Quem já saiu não precisa de alerta de programação.
        OR: [{ ativo: true }, { dataDesligamento: { not: null } }],
      },
      select: {
        id: true,
        nome: true,
        tipoContrato: true,
        ativo: true,
        dataAdmissao: true,
        dataDesligamento: true,
        equipe: { select: { id: true, nome: true } },
      },
      orderBy: { nome: 'asc' },
    });

    const ids = colaboradores.map((item) => item.id);
    if (ids.length === 0) return { colaboradores, faltas: [], ferias: [], ajustes: [] };

    const [faltas, ferias, ajustes] = await Promise.all([
      // Só falta injustificada reduz o direito; atestado e licença não.
      prisma.absence.findMany({
        where: { tenantId, colaboradorId: { in: ids }, tipo: 'falta', status: 'aprovado' },
        select: { colaboradorId: true, dataInicio: true, dataFim: true },
      }),
      prisma.vacation.findMany({
        where: { tenantId, colaboradorId: { in: ids }, status: { in: ['aprovado', 'pendente'] } },
        select: {
          id: true,
          colaboradorId: true,
          cicloNumero: true,
          dataInicio: true,
          dataFim: true,
          diasAbono: true,
          status: true,
        },
      }),
      prisma.vacationAdjustment.findMany({
        where: { tenantId, colaboradorId: { in: ids } },
        select: { colaboradorId: true, cicloNumero: true, diasDelta: true, motivo: true },
      }),
    ]);

    return { colaboradores, faltas, ferias, ajustes };
  },

  criarAjuste(data: {
    tenantId: number;
    colaboradorId: number;
    cicloNumero: number;
    diasDelta: number;
    motivo: string;
    registradoPorId?: number | null;
  }) {
    return prisma.vacationAdjustment.create({ data });
  },

  listarAjustes(tenantId: number, colaboradorId: number) {
    return prisma.vacationAdjustment.findMany({
      where: { tenantId, colaboradorId },
      include: { registradoPor: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export const notificationRepository = {
  /**
   * Grava só o que ainda não existe.
   *
   * `skipDuplicates` com o unique (destinatario, chaveIdempotencia) é o que
   * torna a varredura diária segura: rodar de novo — ou em duas instâncias ao
   * mesmo tempo — não duplica aviso.
   */
  emitirEmLote(
    dados: Array<{
      tenantId: number;
      destinatarioId: number;
      tipo: NotificationType;
      severidade: NotificationSeverity;
      titulo: string;
      mensagem: string;
      link?: string | null;
      entidade?: string | null;
      entidadeId?: string | null;
      chaveIdempotencia: string;
    }>
  ) {
    if (dados.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({ data: dados, skipDuplicates: true });
  },

  listarDoUsuario(destinatarioId: number, params: { apenasNaoLidas?: boolean; take?: number } = {}) {
    return prisma.notification.findMany({
      where: { destinatarioId, ...(params.apenasNaoLidas ? { lidaEm: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
    });
  },

  contarNaoLidas(destinatarioId: number) {
    return prisma.notification.count({ where: { destinatarioId, lidaEm: null } });
  },

  marcarLida(destinatarioId: number, id: number) {
    return prisma.notification.updateMany({
      where: { id, destinatarioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
  },

  marcarTodasLidas(destinatarioId: number) {
    return prisma.notification.updateMany({
      where: { destinatarioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
  },

  /// Quem deve receber alertas de RH de uma equipe: os gestores dela.
  gestoresDasEquipes(tenantId: number, teamIds: number[]) {
    return prisma.managerTeam.findMany({
      where: { tenantId, equipeId: { in: teamIds } },
      select: { gestorId: true, equipeId: true },
    });
  },
};
