import { directoryDefaults, env } from '../../../config/env';
import { directoryRepository } from '../directory.repository';
import { contextoDaConexao, decifrar } from '../crypto';
import { criarProvider } from '../providers';
import { SincronizacaoEmAndamentoError, sincronizarPessoas } from './sync.engine';

/**
 * Agendador da sincronização de diretório.
 *
 * Roda no próprio processo do backend, sem infraestrutura nova. A pergunta
 * óbvia — "e se houver duas instâncias?" — é respondida pela trava de
 * reivindicação na tabela de conexões: as duas acordam, as duas tentam, uma
 * ganha e a outra segue em frente. Sem fila, sem lock distribuído, sem cron
 * externo para operar.
 *
 * Se o volume um dia justificar, o mesmo motor roda como processo separado sem
 * mudar uma linha daqui.
 */

/// De quanto em quanto tempo o agendador acorda para OLHAR. Não é o intervalo
/// de sincronização: esse é por empresa e vive nas opções da conexão. Acordar a
/// cada minuto é barato (uma consulta) e dá granularidade suficiente para um
/// intervalo mínimo de 15 minutos.
const BATIDA_MS = 60_000;

/// Uma execução que passa disto é abandonada pelo agendador na hora de decidir
/// se a conexão está ocupada. Espelha o prazo do motor.
const OCUPADA_POR_MS = 60 * 60 * 1000;

type Conexao = Awaited<ReturnType<typeof directoryRepository.conexoesAtivas>>[number];

/// Quando esta conexão deveria rodar de novo.
export function proximaExecucao(conexao: Pick<Conexao, 'ultimaSincronizacaoEm' | 'opcoes'>): Date {
  const opcoes = (conexao.opcoes ?? {}) as Record<string, unknown>;
  const minutos = Number(opcoes.intervaloMinutos) || directoryDefaults.intervaloMinutos;

  // Nunca sincronizada = vencida desde sempre, para a primeira carga acontecer
  // logo depois de a conexão ser ativada em vez de esperar um intervalo inteiro.
  if (!conexao.ultimaSincronizacaoEm) return new Date(0);
  return new Date(conexao.ultimaSincronizacaoEm.getTime() + minutos * 60_000);
}

export function estaVencida(conexao: Conexao, agora: Date): boolean {
  // Ocupada por outra execução (ou por uma que morreu há pouco): não é a vez.
  if (conexao.sincronizandoDesde && conexao.sincronizandoDesde.getTime() > agora.getTime() - OCUPADA_POR_MS) {
    return false;
  }

  const opcoes = (conexao.opcoes ?? {}) as Record<string, unknown>;
  // Conexão que não lê pessoas não tem o que sincronizar nesta fase.
  if (opcoes.sincronizarUsuarios === false) return false;

  return proximaExecucao(conexao).getTime() <= agora.getTime();
}

async function sincronizarUma(conexao: Conexao): Promise<void> {
  const opcoes = (conexao.opcoes ?? {}) as Record<string, unknown>;

  const provider = criarProvider(conexao.provider, {
    tenantId: conexao.provedorTenantId,
    clientId: conexao.clientId,
    clientSecret: decifrar(conexao.clientSecretCifrado, contextoDaConexao(conexao.tenantId)),
    authorityUrl: conexao.authorityUrl,
  });

  await sincronizarPessoas({
    tenantId: conexao.tenantId,
    connectionId: conexao.id,
    provider,
    cursor: conexao.cursorPessoas,
    modo: 'auto',
    incluirDesabilitados: opcoes.sincronizarUsuariosDesabilitados !== false,
    logOperacoes: opcoes.logOperacoes !== false,
    // Nulo marca "foi o agendador", e é o que a tela mostra na coluna de quem
    // disparou.
    disparadoPorId: null,
  });
}

/**
 * Uma batida do agendador. Exportada para ser testável sem relógio.
 *
 * Sincroniza em série, e não em paralelo: cada carga sai para a rede do
 * provedor, e disparar todas as empresas de uma vez transformaria o backend
 * numa fonte de rajadas — inclusive contra o limite de taxa da Microsoft, que
 * é medido por aplicação.
 */
export async function baterUmaVez(agora = new Date()): Promise<{ verificadas: number; sincronizadas: number }> {
  const conexoes = await directoryRepository.conexoesAtivas();
  const vencidas = conexoes.filter((conexao) => estaVencida(conexao, agora));

  let sincronizadas = 0;

  for (const conexao of vencidas) {
    try {
      await sincronizarUma(conexao);
      sincronizadas += 1;
    } catch (erro) {
      // Perder a corrida pela trava é o funcionamento normal com mais de uma
      // instância — não merece log de erro.
      if (erro instanceof SincronizacaoEmAndamentoError) continue;

      // Qualquer outra falha já foi registrada na execução pelo motor; aqui só
      // se garante que uma empresa com problema não impeça as seguintes.
      // eslint-disable-next-line no-console
      console.error(`[diretorio] falha ao sincronizar a conexão ${conexao.id}:`, erro);
    }
  }

  return { verificadas: conexoes.length, sincronizadas };
}

let timer: NodeJS.Timeout | null = null;

/**
 * Liga o agendador. Devolve a função que o desliga.
 *
 * Não faz nada com o módulo desabilitado — quem não usa diretório não paga por
 * uma consulta a cada minuto.
 */
export function iniciarAgendador(): () => void {
  if (!env.enableEntraSync) return () => undefined;
  if (timer) return pararAgendador;

  // `unref` para o timer não segurar o processo vivo no encerramento.
  timer = setInterval(() => {
    void baterUmaVez().catch((erro) => {
      // eslint-disable-next-line no-console
      console.error('[diretorio] falha na batida do agendador:', erro);
    });
  }, BATIDA_MS);
  timer.unref();

  // eslint-disable-next-line no-console
  console.log('[diretorio] agendador ligado');
  return pararAgendador;
}

export function pararAgendador() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
