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

  // ---------------------------------------------------------------- espelho

  /**
   * Grava uma pessoa do diretório.
   *
   * `upsert` pela chave `(connectionId, externalId)` — o Object ID. Reexecutar
   * a sincronização atualiza em vez de duplicar, que é o que torna a operação
   * repetível sem medo.
   *
   * `colaboradorId` e `camposBloqueados` NÃO aparecem aqui: são a ponte com o
   * mundo operacional e a trava de campo, ambos decisão de gente. A
   * sincronização atualiza o retrato do diretório e não toca na ponte.
   */
  upsertPessoa(
    tenantId: number,
    connectionId: number,
    pessoa: Omit<Prisma.DirectoryPersonUncheckedCreateInput, 'tenantId' | 'connectionId'>
  ) {
    const agora = new Date();
    return prisma.directoryPerson.upsert({
      where: { connectionId_externalId: { connectionId, externalId: pessoa.externalId } },
      create: { ...pessoa, tenantId, connectionId, primeiraVezEm: agora, ultimaVezEm: agora },
      update: {
        ...pessoa,
        ultimaVezEm: agora,
        // Reaparecer no diretório desfaz a marca de removido: ou a pessoa
        // voltou, ou a execução anterior a perdeu por engano.
        removidoEm: null,
      },
    });
  },

  /// Quem já está no espelho, para distinguir criação de atualização sem uma
  /// consulta por pessoa.
  async idsExistentes(connectionId: number): Promise<Set<string>> {
    const pessoas = await prisma.directoryPerson.findMany({
      where: { connectionId },
      select: { externalId: true },
    });
    return new Set(pessoas.map((pessoa) => pessoa.externalId));
  },

  /**
   * Marca como removido quem não apareceu nesta execução completa.
   *
   * Nunca DELETE: a pessoa pode estar vinculada a um colaborador que aparece
   * no histórico de escalas. Some do diretório, permanece no espelho.
   */
  marcarAusentes(connectionId: number, externalIdsVistos: string[], quando: Date) {
    return prisma.directoryPerson.updateMany({
      where: { connectionId, removidoEm: null, externalId: { notIn: externalIdsVistos } },
      data: { removidoEm: quando },
    });
  },

  /// Valores distintos de um campo entre as pessoas presentes, com a contagem.
  /// É daqui que saem os catálogos: no Graph, departamento e cargo são texto
  /// livre no usuário, não recursos com endpoint próprio.
  async contarPorCampo(connectionId: number, campo: 'departamento' | 'cargo') {
    const grupos = await prisma.directoryPerson.groupBy({
      by: [campo],
      where: { connectionId, removidoEm: null, [campo]: { not: null } },
      _count: { _all: true },
    });
    return grupos
      .map((grupo) => ({ nome: grupo[campo] as string, pessoas: grupo._count._all }))
      .filter((item) => item.nome.trim() !== '');
  },

  async sincronizarCatalogo(
    tipo: 'departamento' | 'cargo',
    tenantId: number,
    connectionId: number,
    itens: Array<{ nome: string; pessoas: number }>
  ) {
    const agora = new Date();
    const modelo = (tipo === 'departamento' ? prisma.directoryDepartment : prisma.directoryJobTitle) as
      typeof prisma.directoryDepartment;

    for (const item of itens) {
      await modelo.upsert({
        where: { connectionId_nome: { connectionId, nome: item.nome } },
        create: { tenantId, connectionId, nome: item.nome, pessoas: item.pessoas, primeiraVezEm: agora, ultimaVezEm: agora },
        update: { pessoas: item.pessoas, ativo: true, ultimaVezEm: agora },
      });
    }

    // Catálogo que ninguém referencia mais vira inativo, nunca apagado: tela de
    // histórico e relatório antigo continuam podendo nomeá-lo.
    return modelo.updateMany({
      where: { connectionId, ativo: true, nome: { notIn: itens.map((item) => item.nome) } },
      data: { ativo: false, pessoas: 0 },
    });
  },

  // -------------------------------------------------------------- execuções

  /// Uma execução em andamento impede outra: a segunda faria o mesmo trabalho
  /// e embaralharia os contadores da primeira.
  execucaoEmAndamento(connectionId: number) {
    return prisma.directorySyncRun.findFirst({
      where: { connectionId, status: 'executando' },
      orderBy: { iniciadoEm: 'desc' },
    });
  },

  abrirExecucao(data: Prisma.DirectorySyncRunUncheckedCreateInput) {
    return prisma.directorySyncRun.create({ data });
  },

  fecharExecucao(runId: number, data: Prisma.DirectorySyncRunUncheckedUpdateInput) {
    return prisma.directorySyncRun.update({ where: { id: runId }, data: { ...data, finalizadoEm: new Date() } });
  },

  registrarEventos(eventos: Prisma.DirectorySyncEventUncheckedCreateInput[]) {
    if (eventos.length === 0) return Promise.resolve({ count: 0 });
    return prisma.directorySyncEvent.createMany({ data: eventos });
  },

  listarExecucoes(tenantId: number, connectionId: number, take = 20) {
    return prisma.directorySyncRun.findMany({
      where: { tenantId, connectionId },
      orderBy: { iniciadoEm: 'desc' },
      take,
      include: { disparadoPor: { select: { id: true, nome: true } } },
    });
  },

  listarEventos(runId: number, take = 200) {
    return prisma.directorySyncEvent.findMany({ where: { runId }, orderBy: { id: 'asc' }, take });
  },

  atualizarCursor(connectionId: number, cursorPessoas: string | null) {
    return prisma.directoryConnection.update({
      where: { id: connectionId },
      data: { cursorPessoas, ultimaSincronizacaoEm: new Date() },
    });
  },

  // ---------------------------------------------------------- leitura da UI

  async listarPessoas(
    tenantId: number,
    connectionId: number,
    filtros: { busca?: string; departamento?: string; incluirRemovidos?: boolean; take?: number }
  ) {
    const busca = filtros.busca?.trim();
    const where: Prisma.DirectoryPersonWhereInput = {
      tenantId,
      connectionId,
      ...(filtros.incluirRemovidos ? {} : { removidoEm: null }),
      ...(filtros.departamento ? { departamento: filtros.departamento } : {}),
      ...(busca
        ? {
            OR: [
              { nomeExibicao: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca, mode: 'insensitive' } },
              { cargo: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [pessoas, total] = await Promise.all([
      prisma.directoryPerson.findMany({
        where,
        orderBy: { nomeExibicao: 'asc' },
        take: filtros.take ?? 50,
        select: {
          id: true,
          externalId: true,
          nomeExibicao: true,
          email: true,
          cargo: true,
          departamento: true,
          contaHabilitada: true,
          removidoEm: true,
          ultimaVezEm: true,
          colaboradorId: true,
        },
      }),
      prisma.directoryPerson.count({ where }),
    ]);

    return { pessoas, total };
  },

  resumoDoEspelho(tenantId: number, connectionId: number) {
    return prisma.$transaction([
      prisma.directoryPerson.count({ where: { tenantId, connectionId, removidoEm: null } }),
      prisma.directoryPerson.count({ where: { tenantId, connectionId, removidoEm: null, contaHabilitada: false } }),
      prisma.directoryPerson.count({ where: { tenantId, connectionId, removidoEm: { not: null } } }),
      prisma.directoryPerson.count({ where: { tenantId, connectionId, colaboradorId: { not: null } } }),
    ]);
  },

  listarCatalogos(tenantId: number, connectionId: number) {
    return prisma.$transaction([
      prisma.directoryDepartment.findMany({
        where: { tenantId, connectionId },
        orderBy: [{ ativo: 'desc' }, { pessoas: 'desc' }, { nome: 'asc' }],
      }),
      prisma.directoryJobTitle.findMany({
        where: { tenantId, connectionId },
        orderBy: [{ ativo: 'desc' }, { pessoas: 'desc' }, { nome: 'asc' }],
      }),
    ]);
  },
};
