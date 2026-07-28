import type { Prisma } from '@prisma/client';
import { directoryRepository } from '../directory.repository';
import { CursorExpiradoError, type DirectoryProvider, type PessoaDiretorio } from '../providers/provider.types';
import {
  criarColaboradoresAutomaticamente,
  reconciliarVinculados,
  type ResultadoDaReconciliacao,
} from './reconcile.service';

/**
 * Motor de sincronização.
 *
 * Escreve EXCLUSIVAMENTE em `diretorio_*`. Não conhece colaborador, equipe,
 * escala, turno nem férias — e não é por disciplina: os imports deste arquivo
 * são verificados por teste (`__tests__/isolamento.test.ts`), que quebra o
 * build se alguém trouxer um repositório operacional para cá.
 *
 * A travessia para a operação acontece na reconciliação (Fase D), em arquivo
 * próprio, com lista fechada de campos.
 */

export type ModoSolicitado = 'auto' | 'completa';

export type ResultadoDaSincronizacao = {
  runId: number;
  modo: 'completa' | 'incremental';
  status: 'sucesso' | 'parcial' | 'erro';
  lidos: number;
  criados: number;
  atualizados: number;
  removidos: number;
  departamentos: number;
  cargos: number;
  gestores: number;
  grupos: number;
  /// Verdadeiro quando começou incremental e teve de recomeçar do zero porque
  /// o provedor invalidou o cursor.
  recomecouDoZero: boolean;
  /// Nulo quando a empresa não ligou nenhuma das opções que alcançam o
  /// cadastro — que é o padrão, e o caso em que nada operacional foi tocado.
  reconciliacao: ResultadoDaReconciliacao | null;
  erro: string | null;
};

export type ParametrosDeSincronizacao = {
  tenantId: number;
  connectionId: number;
  provider: DirectoryProvider;
  /// Cursor guardado da execução anterior. Nulo força leitura completa.
  cursor?: string | null;
  modo?: ModoSolicitado;
  /// Conta desabilitada fica no espelho? Política da empresa, aplicada aqui e
  /// não no provedor — ver `OpcoesDeLeitura`.
  incluirDesabilitados: boolean;
  logOperacoes: boolean;
  disparadoPorId?: number | null;

  /// As duas únicas opções que alcançam o cadastro. Nascem desligadas, e
  /// desligadas a sincronização inteira não escreve uma linha operacional.
  autoCriarColaboradores?: boolean;
  autoDesativarColaboradores?: boolean;
  /// Equipe de entrada da criação automática. Sem ela, não há criação:
  /// `colaboradores.equipe_id` é NOT NULL e o diretório não conhece equipes.
  equipePadraoId?: number | null;

  /// Leituras complementares. Cada uma custa requisições próprias ao provedor,
  /// então são opções e não comportamento padrão.
  sincronizarGestores?: boolean;
  sincronizarGrupos?: boolean;
};

export class SincronizacaoEmAndamentoError extends Error {}

/// Uma reivindicação mais antiga que isto conta como abandonada. Generoso o
/// bastante para uma carga grande de um tenant corporativo não ser interrompida
/// por si mesma, curto o bastante para não travar a conexão por um dia.
const ABANDONO_APOS_MS = 60 * 60 * 1000;

/// Traduz a forma canônica para as colunas do espelho. Nada aqui decide nada:
/// é cópia de campo, e é de propósito que seja entediante.
function paraLinha(pessoa: PessoaDiretorio): Omit<Prisma.DirectoryPersonUncheckedCreateInput, 'tenantId' | 'connectionId'> {
  return {
    externalId: pessoa.externalId,
    nomeExibicao: pessoa.nomeExibicao,
    primeiroNome: pessoa.primeiroNome,
    sobrenome: pessoa.sobrenome,
    email: pessoa.email,
    userPrincipalName: pessoa.loginPrincipal,
    cargo: pessoa.cargo,
    departamento: pessoa.departamento,
    empresa: pessoa.empresa,
    escritorio: pessoa.escritorio,
    telefone: pessoa.telefone,
    celular: pessoa.celular,
    pais: pessoa.pais,
    cidade: pessoa.cidade,
    estado: pessoa.estado,
    idioma: pessoa.idioma,
    fusoHorario: pessoa.fusoHorario,
    contaHabilitada: pessoa.contaHabilitada,
    gestorExternalId: pessoa.gestorExternalId,
    bruto: (pessoa.bruto ?? undefined) as Prisma.InputJsonValue,
  };
}

/**
 * O que fazer com cada pessoa que o provedor entregou.
 *
 * Separado do laço porque é aqui que mora a política, e política escondida
 * dentro de um `for` é política que ninguém revisa.
 */
function decidir(pessoa: PessoaDiretorio, incluirDesabilitados: boolean): 'gravar' | 'remover' {
  // O provedor disse que o objeto saiu do diretório (marcador do delta).
  if (pessoa.removido) return 'remover';

  // A empresa optou por não guardar contas desabilitadas. Note que ela ainda
  // é PROCESSADA: é justamente por vir na leitura incremental que descobrimos
  // que acabou de ser desabilitada. Filtrá-la na origem manteria o espelho
  // afirmando que ela está ativa para sempre.
  if (!incluirDesabilitados && !pessoa.contaHabilitada) return 'remover';

  return 'gravar';
}

type Acumulado = {
  lidos: number;
  criados: number;
  atualizados: number;
  removidos: number;
  conflitos: number;
  cursor: string | null;
  vistos: string[];
  concluiu: boolean;
  erro: string | null;
};

/**
 * Executa uma sincronização.
 *
 * Grava página a página, e não tudo ao final: num tenant de milhares de contas,
 * acumular em memória transformaria uma falha no meio em "nada foi salvo". Com
 * gravação incremental, uma interrupção deixa a execução `parcial` — o que já
 * entrou continua valendo, e a próxima execução completa o resto.
 */
export async function sincronizarPessoas(params: ParametrosDeSincronizacao): Promise<ResultadoDaSincronizacao> {
  const reivindicou = await directoryRepository.reivindicar(
    params.connectionId,
    new Date(Date.now() - ABANDONO_APOS_MS)
  );

  if (!reivindicou) {
    throw new SincronizacaoEmAndamentoError(
      'Já existe uma sincronização em andamento para esta conexão. Aguarde ela terminar.'
    );
  }

  try {
    return await executar(params);
  } finally {
    // `finally` e não no caminho feliz: exceção inesperada que deixasse a
    // trava presa inutilizaria a conexão até o prazo de abandono.
    await directoryRepository.liberar(params.connectionId);
  }
}

async function executar(params: ParametrosDeSincronizacao): Promise<ResultadoDaSincronizacao> {
  const querIncremental = params.modo !== 'completa' && Boolean(params.cursor);
  const run = await directoryRepository.abrirExecucao({
    tenantId: params.tenantId,
    connectionId: params.connectionId,
    modo: querIncremental ? 'incremental' : 'completa',
    status: 'executando',
    disparadoPorId: params.disparadoPorId ?? null,
  });

  const eventos: Prisma.DirectorySyncEventUncheckedCreateInput[] = [];
  function registrar(nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) {
    // `logOperacoes` desligado ainda registra o que deu errado: é justamente o
    // que alguém vai procurar depois. O que se corta é o "atualizei fulano".
    if (!params.logOperacoes && nivel === 'info') return;
    eventos.push({ runId: run.id, nivel, entidade: 'pessoa', externalId, acao, mensagem });
  }

  let modo: 'completa' | 'incremental' = querIncremental ? 'incremental' : 'completa';
  let recomecouDoZero = false;
  let acumulado = await ler(params, modo, registrar);

  // O provedor invalidou o cursor (delta parado tempo demais, ou mudança de
  // configuração do tenant). Não é falha: é "recomece do zero", e recomeçar
  // sozinho é o que impede a sincronização de morrer em silêncio.
  if (acumulado.expirou) {
    registrar('aviso', null, 'cursor_expirado', 'O cursor incremental expirou. Refazendo a leitura completa.');
    modo = 'completa';
    recomecouDoZero = true;
    acumulado = await ler(params, 'completa', registrar);
  }

  let departamentos = 0;
  let cargos = 0;
  let reconciliacao: ResultadoDaReconciliacao | null = null;
  let gestores = 0;
  let grupos = 0;

  if (acumulado.concluiu) {
    // Só a leitura completa sabe quem sumiu por ausência. Na incremental, o
    // provedor informa cada saída explicitamente — deduzir por ausência ali
    // marcaria como removido todo mundo que apenas não mudou.
    if (modo === 'completa') {
      const ausentes = await directoryRepository.marcarAusentes(params.connectionId, acumulado.vistos, new Date());
      acumulado.removidos += ausentes.count;
      if (ausentes.count > 0) {
        registrar('aviso', null, 'ausentes', `${ausentes.count} pessoa(s) não vieram nesta leitura e foram marcadas como removidas`);
      }
    }

    // Os catálogos derivam do espelho já gravado, não do que veio na resposta:
    // assim a contagem bate com o que a tela mostra, mesmo que alguma pessoa
    // tenha falhado ao gravar — e, na incremental, cobre também quem não veio.
    const [porDepartamento, porCargo] = await Promise.all([
      directoryRepository.contarPorCampo(params.connectionId, 'departamento'),
      directoryRepository.contarPorCampo(params.connectionId, 'cargo'),
    ]);

    await directoryRepository.sincronizarCatalogo('departamento', params.tenantId, params.connectionId, porDepartamento);
    await directoryRepository.sincronizarCatalogo('cargo', params.tenantId, params.connectionId, porCargo);

    departamentos = porDepartamento.length;
    cargos = porCargo.length;

    // Cursor novo só é guardado quando a leitura fechou. Guardá-lo depois de
    // uma leitura interrompida faria a próxima execução pular o que faltou.
    await directoryRepository.atualizarCursor(params.connectionId, acumulado.cursor);

    // Gestores e grupos vêm depois das pessoas porque dependem delas: o gestor
    // é referência a um Object ID que precisa existir no espelho, e o membro de
    // um grupo é uma pessoa que precisa já ter sido gravada.
    if (params.sincronizarGestores) {
      gestores = await lerGestores(params, registrar);
    }
    if (params.sincronizarGrupos) {
      grupos = await lerGrupos(params, registrar);
    }

    // A ÚNICA parte da sincronização que alcança o cadastro, e só quando a
    // empresa pediu. Depois da leitura ter fechado: reconciliar a partir de um
    // espelho pela metade aplicaria dados incompletos sobre gente de verdade.
    reconciliacao = await reconciliar(params, registrar);
  }

  const status: ResultadoDaSincronizacao['status'] = !acumulado.concluiu
    ? 'erro'
    : acumulado.conflitos > 0
      ? 'parcial'
      : 'sucesso';

  await directoryRepository.registrarEventos(eventos);
  await directoryRepository.fecharExecucao(run.id, {
    modo,
    status,
    objetosLidos: acumulado.lidos,
    objetosCriados: acumulado.criados,
    objetosAtualizados: acumulado.atualizados,
    objetosInalterados: 0,
    objetosRemovidos: acumulado.removidos,
    conflitos: acumulado.conflitos,
    erro: acumulado.erro,
    detalhes: {
      departamentos,
      cargos,
      gestores,
      grupos,
      recomecouDoZero,
      reconciliacao: reconciliacao
        ? {
            atualizados: reconciliacao.atualizados,
            criados: reconciliacao.criados,
            desativados: reconciliacao.desativados,
            reativados: reconciliacao.reativados,
            conflitos: reconciliacao.conflitos.length,
          }
        : null,
    } as Prisma.InputJsonValue,
  });

  return {
    runId: run.id,
    modo,
    status,
    lidos: acumulado.lidos,
    criados: acumulado.criados,
    atualizados: acumulado.atualizados,
    removidos: acumulado.removidos,
    departamentos,
    cargos,
    gestores,
    grupos,
    recomecouDoZero,
    reconciliacao,
    erro: acumulado.erro,
  };
}

/**
 * Passada de gestores.
 *
 * Separada da leitura de pessoas porque no Graph o gestor não vem junto: são
 * requisições próprias, uma por pessoa, agrupadas em lotes pelo provedor.
 *
 * Uma consequência a conhecer: a hierarquia é relida a partir de quem está no
 * espelho, então uma execução incremental que trouxe cinco pessoas ainda
 * pergunta o gestor de todo mundo. Perguntar só dos cinco deixaria passar a
 * mudança de chefia de quem não teve outro campo alterado — o Graph não reporta
 * troca de gestor no delta de usuários.
 */
async function lerGestores(
  params: ParametrosDeSincronizacao,
  registrar: (nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) => void
): Promise<number> {
  try {
    const ids = await directoryRepository.externalIdsPresentes(params.connectionId);
    if (ids.length === 0) return 0;

    const hierarquia = await params.provider.listarGestores(ids);
    const { comGestor, limpos } = await directoryRepository.atualizarGestores(params.connectionId, hierarquia);

    registrar('info', null, 'gestores', `${comGestor} pessoa(s) com gestor identificado${limpos > 0 ? `, ${limpos} sem gestor agora` : ''}`);
    return comGestor;
  } catch (falha) {
    // Hierarquia é acessória: sem ela o espelho continua correto, só não há
    // organograma. Não vale derrubar a execução inteira.
    registrar(
      'aviso',
      null,
      'gestores_falharam',
      `Não foi possível ler a hierarquia: ${falha instanceof Error ? falha.message : 'erro desconhecido'}`
    );
    return 0;
  }
}

/// Passada de grupos. Mesma lógica de tolerância: grupo é informação
/// complementar, e sua falha não invalida as pessoas já gravadas.
async function lerGrupos(
  params: ParametrosDeSincronizacao,
  registrar: (nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) => void
): Promise<number> {
  const vistos: string[] = [];
  let total = 0;

  try {
    for await (const pagina of params.provider.listarGrupos()) {
      for (const grupo of pagina) {
        const gravado = await directoryRepository.upsertGrupo(params.tenantId, params.connectionId, {
          externalId: grupo.externalId,
          nome: grupo.nome,
          descricao: grupo.descricao,
          email: grupo.email,
          tipo: grupo.tipo,
          bruto: (grupo.bruto ?? undefined) as Prisma.InputJsonValue,
        });

        await directoryRepository.substituirMembros(
          params.tenantId,
          gravado.id,
          params.connectionId,
          grupo.membrosExternalIds
        );

        vistos.push(grupo.externalId);
        total += 1;
      }
    }

    const ausentes = await directoryRepository.marcarGruposAusentes(params.connectionId, vistos, new Date());
    registrar('info', null, 'grupos', `${total} grupo(s) lido(s)${ausentes.count > 0 ? `, ${ausentes.count} não vieram` : ''}`);
    return total;
  } catch (falha) {
    registrar(
      'aviso',
      null,
      'grupos_falharam',
      `Não foi possível ler os grupos: ${falha instanceof Error ? falha.message : 'erro desconhecido'}`
    );
    return total;
  }
}

/**
 * Aplica o diretório sobre o cadastro, se — e só se — a empresa tiver pedido.
 *
 * Com as duas opções desligadas (o padrão), devolve `null` e a sincronização
 * inteira não escreveu uma linha operacional. É a diferença entre o módulo
 * "espelha o diretório" e o módulo "mexe no meu cadastro", e ela é uma escolha
 * explícita de quem administra a empresa.
 */
async function reconciliar(
  params: ParametrosDeSincronizacao,
  registrar: (nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) => void
): Promise<ResultadoDaReconciliacao | null> {
  const autoDesativar = params.autoDesativarColaboradores === true;
  const autoCriar = params.autoCriarColaboradores === true;

  // Reconciliar os já vinculados acontece sempre que houver vínculo: manter o
  // nome e o cargo em dia é o propósito de ter vinculado. O que as opções
  // controlam é mexer em `ativo` e criar cadastro novo.
  const vinculados = await reconciliarVinculados({
    tenantId: params.tenantId,
    connectionId: params.connectionId,
    autoDesativar,
  });

  const resultado = vinculados;

  if (autoCriar) {
    if (params.equipePadraoId == null) {
      registrar(
        'erro',
        null,
        'sem_equipe_padrao',
        'Criação automática de colaboradores está ligada, mas nenhuma equipe de entrada foi escolhida. Nada foi criado.'
      );
    } else {
      const criados = await criarColaboradoresAutomaticamente({
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        equipePadraoId: params.equipePadraoId,
      });
      resultado.criados += criados.criados;
      resultado.conflitos.push(...criados.conflitos);
    }
  }

  for (const mudanca of resultado.mudancas) {
    registrar(
      'info',
      mudanca.externalId,
      'reconciliada',
      `Cadastro atualizado: ${mudanca.campos.map((campo) => campo.campo).join(', ')}`
    );
  }

  for (const conflito of resultado.conflitos) {
    registrar('aviso', conflito.externalId, 'conflito_reconciliacao', `${conflito.nome}: ${conflito.motivo}`);
  }

  const mexeu = resultado.atualizados + resultado.criados + resultado.conflitos.length;
  return mexeu > 0 || autoCriar || autoDesativar ? resultado : null;
}

/// Uma passada de leitura. Isolada para que a queda de incremental para
/// completa seja literalmente chamar de novo, com o estado zerado — em vez de
/// desfazer contadores pela metade.
async function ler(
  params: ParametrosDeSincronizacao,
  modo: 'completa' | 'incremental',
  registrar: (nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) => void
): Promise<Acumulado & { expirou: boolean }> {
  const existentes = await directoryRepository.idsExistentes(params.connectionId);
  const acumulado: Acumulado & { expirou: boolean } = {
    lidos: 0,
    criados: 0,
    atualizados: 0,
    removidos: 0,
    conflitos: 0,
    cursor: null,
    vistos: [],
    concluiu: false,
    erro: null,
    expirou: false,
  };

  try {
    for await (const pagina of params.provider.listarPessoas({
      cursor: modo === 'incremental' ? params.cursor : null,
    })) {
      for (const pessoa of pagina.pessoas) {
        acumulado.lidos += 1;

        try {
          if (decidir(pessoa, params.incluirDesabilitados) === 'remover') {
            acumulado.removidos += await directoryRepository.marcarRemovida(
              params.connectionId,
              pessoa.externalId,
              new Date()
            );
            registrar('info', pessoa.externalId, 'removida', `Saiu do espelho: ${pessoa.nomeExibicao}`);
            continue;
          }

          await directoryRepository.upsertPessoa(params.tenantId, params.connectionId, paraLinha(pessoa));
          acumulado.vistos.push(pessoa.externalId);

          if (existentes.has(pessoa.externalId)) {
            // "Já existia no espelho", não "mudou alguma coisa": distinguir os
            // dois exigiria comparar campo a campo, e a carga completa reescreve
            // todo mundo de qualquer forma. `objetosInalterados` fica zerado.
            acumulado.atualizados += 1;
          } else {
            acumulado.criados += 1;
            registrar('info', pessoa.externalId, 'criada', `Nova no espelho: ${pessoa.nomeExibicao}`);
          }
        } catch (falha) {
          // Uma pessoa problemática não derruba a carga inteira — o resto do
          // diretório continua entrando, e o conflito fica registrado com nome
          // e id para alguém resolver.
          acumulado.conflitos += 1;
          registrar(
            'erro',
            pessoa.externalId,
            'conflito',
            `Não foi possível gravar ${pessoa.nomeExibicao}: ${falha instanceof Error ? falha.message : 'erro desconhecido'}`
          );
        }
      }

      if (pagina.cursor) acumulado.cursor = pagina.cursor;
    }

    acumulado.concluiu = true;
  } catch (falha) {
    if (falha instanceof CursorExpiradoError) {
      acumulado.expirou = true;
      return acumulado;
    }

    acumulado.erro = falha instanceof Error ? falha.message : 'Falha ao ler o diretório';
    registrar('erro', null, 'leitura_interrompida', acumulado.erro);
  }

  return acumulado;
}
