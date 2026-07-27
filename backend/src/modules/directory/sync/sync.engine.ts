import type { Prisma } from '@prisma/client';
import { directoryRepository } from '../directory.repository';
import type { DirectoryProvider, PessoaDiretorio } from '../providers/provider.types';

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

export type ResultadoDaSincronizacao = {
  runId: number;
  status: 'sucesso' | 'parcial' | 'erro';
  lidos: number;
  criados: number;
  atualizados: number;
  removidos: number;
  departamentos: number;
  cargos: number;
  erro: string | null;
};

export type ParametrosDeSincronizacao = {
  tenantId: number;
  connectionId: number;
  provider: DirectoryProvider;
  incluirDesabilitados: boolean;
  logOperacoes: boolean;
  disparadoPorId?: number | null;
};

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

export class SincronizacaoEmAndamentoError extends Error {}

/**
 * Executa uma sincronização completa.
 *
 * Grava página a página, e não tudo ao final: num tenant de milhares de contas,
 * acumular em memória transformaria uma falha no meio em "nada foi salvo". Com
 * gravação incremental, uma interrupção deixa a execução `parcial` — o que já
 * entrou continua valendo, e a próxima execução completa o resto.
 *
 * Por isso também os ausentes só são marcados quando a leitura terminou
 * inteira: marcar a partir de uma leitura interrompida apagaria do espelho
 * gente que apenas não chegou a ser lida.
 */
export async function sincronizarPessoas(params: ParametrosDeSincronizacao): Promise<ResultadoDaSincronizacao> {
  const emAndamento = await directoryRepository.execucaoEmAndamento(params.connectionId);
  if (emAndamento) {
    throw new SincronizacaoEmAndamentoError(
      `Já existe uma sincronização em andamento desde ${emAndamento.iniciadoEm.toLocaleString('pt-BR')}. Aguarde ela terminar.`
    );
  }

  const run = await directoryRepository.abrirExecucao({
    tenantId: params.tenantId,
    connectionId: params.connectionId,
    modo: 'completa',
    status: 'executando',
    disparadoPorId: params.disparadoPorId ?? null,
  });

  const existentes = await directoryRepository.idsExistentes(params.connectionId);
  const vistos: string[] = [];
  const eventos: Prisma.DirectorySyncEventUncheckedCreateInput[] = [];

  let lidos = 0;
  let criados = 0;
  let atualizados = 0;
  let conflitos = 0;
  let cursor: string | null = null;
  let leituraCompleta = false;
  let erro: string | null = null;

  function registrar(nivel: 'info' | 'aviso' | 'erro', externalId: string | null, acao: string, mensagem: string) {
    // `logOperacoes` desligado ainda registra o que deu errado: é justamente o
    // que alguém vai procurar depois. O que se corta é o "atualizei fulano".
    if (!params.logOperacoes && nivel === 'info') return;
    eventos.push({ runId: run.id, nivel, entidade: 'pessoa', externalId, acao, mensagem });
  }

  try {
    for await (const pagina of params.provider.listarPessoas({
      cursor: null,
      incluirDesabilitados: params.incluirDesabilitados,
    })) {
      for (const pessoa of pagina.pessoas) {
        lidos += 1;

        try {
          await directoryRepository.upsertPessoa(params.tenantId, params.connectionId, paraLinha(pessoa));
          vistos.push(pessoa.externalId);

          if (existentes.has(pessoa.externalId)) {
            // "Já existia no espelho", não "mudou alguma coisa": distinguir os
            // dois exigiria comparar campo a campo o que o banco já tem, e a
            // carga completa reescreve todo mundo de qualquer forma. Por isso
            // `objetosInalterados` fica zerado aqui — é a sincronização
            // incremental (Fase C) que terá esse número com significado.
            atualizados += 1;
          } else {
            criados += 1;
            registrar('info', pessoa.externalId, 'criada', `Nova no espelho: ${pessoa.nomeExibicao}`);
          }
        } catch (falha) {
          // Uma pessoa problemática não derruba a carga inteira — o resto do
          // diretório continua entrando, e o conflito fica registrado com nome
          // e id para alguém resolver.
          conflitos += 1;
          registrar(
            'erro',
            pessoa.externalId,
            'conflito',
            `Não foi possível gravar ${pessoa.nomeExibicao}: ${falha instanceof Error ? falha.message : 'erro desconhecido'}`
          );
        }
      }

      if (pagina.cursor) cursor = pagina.cursor;
    }

    leituraCompleta = true;
  } catch (falha) {
    erro = falha instanceof Error ? falha.message : 'Falha ao ler o diretório';
    registrar('erro', null, 'leitura_interrompida', erro);
  }

  let removidos = 0;
  let departamentos = 0;
  let cargos = 0;

  if (leituraCompleta) {
    const ausentes = await directoryRepository.marcarAusentes(params.connectionId, vistos, new Date());
    removidos = ausentes.count;
    if (removidos > 0) {
      registrar('aviso', null, 'ausentes', `${removidos} pessoa(s) não vieram nesta leitura e foram marcadas como removidas`);
    }

    // Os catálogos derivam do espelho já gravado, não do que veio na resposta:
    // assim a contagem bate com o que a tela mostra, mesmo que alguma pessoa
    // tenha falhado ao gravar.
    const [porDepartamento, porCargo] = await Promise.all([
      directoryRepository.contarPorCampo(params.connectionId, 'departamento'),
      directoryRepository.contarPorCampo(params.connectionId, 'cargo'),
    ]);

    await directoryRepository.sincronizarCatalogo('departamento', params.tenantId, params.connectionId, porDepartamento);
    await directoryRepository.sincronizarCatalogo('cargo', params.tenantId, params.connectionId, porCargo);

    departamentos = porDepartamento.length;
    cargos = porCargo.length;

    // Carga completa por `/users` não devolve cursor — só `/users/delta` o faz.
    // Gravar `null` aqui é deliberado: apaga qualquer cursor anterior e força a
    // próxima execução a ser completa também. É a direção segura. Manter um
    // cursor que antecede esta leitura faria a incremental seguinte partir de
    // um ponto que já não descreve o estado do espelho.
    await directoryRepository.atualizarCursor(params.connectionId, cursor);
  }

  const status: ResultadoDaSincronizacao['status'] = !leituraCompleta ? 'erro' : conflitos > 0 ? 'parcial' : 'sucesso';

  await directoryRepository.registrarEventos(eventos);
  await directoryRepository.fecharExecucao(run.id, {
    status,
    objetosLidos: lidos,
    objetosCriados: criados,
    objetosAtualizados: atualizados,
    objetosInalterados: 0,
    objetosRemovidos: removidos,
    conflitos,
    erro,
    detalhes: { departamentos, cargos } as Prisma.InputJsonValue,
  });

  return { runId: run.id, status, lidos, criados, atualizados, removidos, departamentos, cargos, erro };
}
