/**
 * Contrato que todo provedor de identidade cumpre.
 *
 * A forma aqui é CANÔNICA: nada de `userPrincipalName`, `accountEnabled` ou
 * `@odata.deltaLink`. O vocabulário da Microsoft fica confinado em
 * `providers/entra/` — é o que permitirá plugar Google Workspace, Okta ou
 * LDAP depois sem tocar no motor de sincronização.
 *
 * A interface cresce por fase, e só ganha método quando existe quem o chame:
 *   Fase A (agora) — `testarConexao`
 *   Fase B         — `listarPessoas` (com cursor opaco)
 *   Fase E         — `listarGrupos`, `listarGestores`
 *   Fase F         — `baixarFoto`
 */

import type { DirectoryProviderType } from '@prisma/client';

/// Uma capacidade verificada durante o teste de conexão.
///
/// Cada linha responde "esta permissão foi concedida?" separadamente, porque
/// é assim que a falha acontece na prática: o consentimento de administrador
/// é dado para umas e esquecido para outras, e um "falhou" genérico deixaria
/// quem configura adivinhando qual.
export type VerificacaoDeAcesso = {
  /// O que se tentou ler, em português de quem configura ("Usuários").
  recurso: string;
  /// A permissão que precisa estar concedida, no nome que aparece no portal.
  permissao: string;
  ok: boolean;
  /// Falha em obrigatória reprova o teste; em opcional só limita o que dá
  /// para sincronizar depois. Separar as duas evita que quem só quer
  /// pessoas e departamentos seja barrado por não ter liberado grupos.
  obrigatoria: boolean;
  /// Em caso de sucesso, o que foi encontrado ("1.284 contas").
  /// Em caso de falha, o que fazer a respeito.
  detalhe: string;
};

export type ResultadoDoTeste = {
  ok: boolean;
  /// Preenchido quando a autenticação passou — confirma que as credenciais
  /// apontam para o tenant que quem configura acha que está configurando.
  organizacao: { nome: string; tenantId: string; dominios: string[] } | null;
  verificacoes: VerificacaoDeAcesso[];
  /// Mensagem única quando nem chegou a testar (credencial inválida).
  erro: string | null;
};

/**
 * Uma pessoa como o diretório a descreve, em forma canônica.
 *
 * Nenhum nome aqui é da Microsoft: `userPrincipalName` virou `loginPrincipal`,
 * `accountEnabled` virou `contaHabilitada`, `jobTitle` virou `cargo`. É o que
 * permitirá plugar Google Workspace ou LDAP escrevendo só um mapper.
 *
 * Tudo além de `externalId` e `nomeExibicao` é opcional porque, na prática, é:
 * diretório corporativo tem conta de serviço sem sobrenome, sem departamento e
 * sem telefone, e recusá-las seria recusar metade do tenant.
 */
export type PessoaDiretorio = {
  /// Object ID do provedor. A chave de vínculo — nunca e-mail ou nome.
  externalId: string;
  nomeExibicao: string;
  primeiroNome: string | null;
  sobrenome: string | null;
  email: string | null;
  loginPrincipal: string | null;
  cargo: string | null;
  departamento: string | null;
  empresa: string | null;
  escritorio: string | null;
  telefone: string | null;
  celular: string | null;
  pais: string | null;
  cidade: string | null;
  estado: string | null;
  idioma: string | null;
  fusoHorario: string | null;
  contaHabilitada: boolean;
  gestorExternalId: string | null;
  /// O provedor informou que este objeto saiu do diretório. Só aparece em
  /// sincronização incremental — numa completa, ausência é o que indica saída.
  removido: boolean;
  /// Payload cru, para diagnosticar divergência sem reconsultar o provedor.
  bruto: unknown;
};

export type PaginaDePessoas = {
  pessoas: PessoaDiretorio[];
  /// Cursor OPACO para a próxima execução incremental. Só vem na última
  /// página; o motor nunca interpreta o conteúdo.
  cursor: string | null;
};

export type OpcoesDeLeitura = {
  /// Retomar de onde parou. Nulo = leitura completa.
  cursor?: string | null;
  /// Conta desabilitada entra no espelho por padrão: sumir com ela apagaria o
  /// nome de quem aparece no histórico de escalas.
  incluirDesabilitados: boolean;
};

export interface DirectoryProvider {
  readonly tipo: DirectoryProviderType;

  /**
   * Autentica e confere, permissão a permissão, o que a App Registration
   * consegue ler. Nunca lança por falha de credencial ou de permissão: essas
   * são respostas do teste, não erros do programa. Só lança se o teste em si
   * não pôde ser executado.
   */
  testarConexao(): Promise<ResultadoDoTeste>;

  /**
   * Percorre as pessoas do diretório, uma página por vez.
   *
   * Gerador, e não um array: um tenant corporativo tem milhares de contas, e
   * carregar tudo em memória para só então gravar transformaria uma falha no
   * meio do caminho em "nada foi salvo". Página a página, o que já entrou fica.
   */
  listarPessoas(opcoes: OpcoesDeLeitura): AsyncIterable<PaginaDePessoas>;
}
