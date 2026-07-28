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

/**
 * O cursor de leitura incremental não vale mais e a leitura tem de recomeçar
 * do zero.
 *
 * Mora no contrato, e não na implementação do Entra, porque todo provedor com
 * sincronização incremental tem essa condição: o Graph a chama de
 * `syncStateNotFound`, o Google de `syncToken` inválido, o LDAP de cookie de
 * paginação expirado. O motor precisa reagir a uma coisa só.
 *
 * Não é falha: é o provedor dizendo "recomece". Tratá-la como erro faria a
 * sincronização morrer em silêncio e ninguém perceber por semanas.
 */
export class CursorExpiradoError extends Error {}

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
  ///
  /// Não há opção de filtrar desabilitados aqui de propósito: o provedor relata
  /// o diretório como ele é, e quem decide o que entra no espelho é o motor.
  /// Filtrar na origem quebraria a leitura incremental — uma conta que ACABOU
  /// de ser desabilitada não viria, e o espelho a manteria ativa para sempre.
  cursor?: string | null;
};

/**
 * Um grupo do diretório, com seus membros diretos.
 *
 * Só membros diretos: grupo aninhado é uma aresta entre grupos, e resolvê-la
 * recursivamente exigiria decidir o que fazer com ciclos — problema que não
 * vale pagar antes de alguém precisar.
 */
export type GrupoDiretorio = {
  externalId: string;
  nome: string;
  descricao: string | null;
  email: string | null;
  /// Como o provedor classifica. Texto livre: cada provedor tem os seus.
  tipo: string | null;
  /// Object IDs dos membros. Quem não estiver no espelho é ignorado ao gravar.
  membrosExternalIds: string[];
  removido: boolean;
  bruto: unknown;
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

  /**
   * Quem é o gestor de cada pessoa, por Object ID.
   *
   * Método separado, e não um campo de `PessoaDiretorio`, porque no Graph o
   * gestor não vem junto: `/users/delta` não aceita `$expand=manager`, e
   * `/users/{id}/manager` é uma requisição por pessoa. Deixar isso explícito no
   * contrato é o que permite ao motor decidir quando vale pagar o custo.
   *
   * A chave ausente do mapa significa "não tem gestor" — que é o normal para
   * quem está no topo e para conta de serviço.
   */
  listarGestores(externalIds: string[]): Promise<Map<string, string>>;

  /// Grupos com seus membros diretos.
  listarGrupos(): AsyncIterable<GrupoDiretorio[]>;
}
