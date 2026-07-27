import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Acesso às tabelas do diretório.
 *
 * Este repositório alcança EXCLUSIVAMENTE `diretorio_*`. É a fronteira que
 * garante, na estrutura e não na intenção, que a sincronização não escreve em
 * colaboradores, equipes, escalas, turnos ou férias. A leitura de `equipes`
 * abaixo é a única exceção, e é leitura: valida a equipe padrão informada no
 * formulário.
 *
 * A travessia para o mundo operacional acontece só na reconciliação (Fase D),
 * em arquivo próprio, e existe um teste que falha se algum arquivo de
 * `sync/` importar repositório operacional.
 */
export const directoryRepository = {
  listarConexoes(tenantId: number) {
    return prisma.directoryConnection.findMany({
      where: { tenantId },
      include: { equipePadrao: { select: { id: true, nome: true } } },
      orderBy: { id: 'asc' },
    });
  },

  buscarConexao(tenantId: number, id: number) {
    return prisma.directoryConnection.findFirst({
      where: { tenantId, id },
      include: { equipePadrao: { select: { id: true, nome: true } } },
    });
  },

  buscarConexaoPorProvedor(tenantId: number, provider: Prisma.DirectoryConnectionWhereInput['provider']) {
    return prisma.directoryConnection.findFirst({ where: { tenantId, provider } });
  },

  criarConexao(tenantId: number, data: Omit<Prisma.DirectoryConnectionUncheckedCreateInput, 'tenantId'>) {
    return prisma.directoryConnection.create({
      data: { ...data, tenantId },
      include: { equipePadrao: { select: { id: true, nome: true } } },
    });
  },

  async atualizarConexao(tenantId: number, id: number, data: Prisma.DirectoryConnectionUncheckedUpdateInput) {
    await prisma.directoryConnection.updateMany({ where: { id, tenantId }, data });
    return prisma.directoryConnection.findFirst({
      where: { id, tenantId },
      include: { equipePadrao: { select: { id: true, nome: true } } },
    });
  },

  /// Registra o resultado do teste na própria conexão, para a tela mostrar
  /// "última verificação" sem precisar refazer a chamada ao provedor.
  registrarTeste(tenantId: number, id: number, ok: boolean, erro: string | null) {
    return prisma.directoryConnection.updateMany({
      where: { id, tenantId },
      data: { ultimoTesteEm: new Date(), ultimoTesteOk: ok, ultimoErro: erro },
    });
  },

  /// O que uma conexão deixa para trás. Espelho e execuções somem em cascata
  /// (são réplica e log, reconstituíveis), mas um vínculo com colaborador é
  /// decisão humana registrada — some o vínculo, nunca o colaborador.
  async contarVinculos(tenantId: number, id: number) {
    return prisma.$transaction([
      prisma.directoryPerson.count({ where: { tenantId, connectionId: id } }),
      prisma.directoryPerson.count({ where: { tenantId, connectionId: id, colaboradorId: { not: null } } }),
    ]);
  },

  removerConexao(tenantId: number, id: number) {
    return prisma.directoryConnection.deleteMany({ where: { id, tenantId } });
  },

  /// Leitura de equipe, para validar a equipe padrão do formulário.
  equipeExiste(tenantId: number, equipeId: number) {
    return prisma.team.findFirst({ where: { tenantId, id: equipeId }, select: { id: true, nome: true } });
  },
};
