import { z } from 'zod';
import type { DirectoryConnection, Prisma } from '@prisma/client';
import { directoryDefaults, env } from '../../config/env';
import type { JwtPayload } from '../../types/auth';
import { directoryRepository } from './directory.repository';
import { ChaveDeCifragemAusenteError, cifrar, contextoDaConexao, decifrar, impressaoDigital } from './crypto';
import { criarProvider, ProvedorNaoSuportadoError, type ResultadoDoTeste } from './providers';
import { SincronizacaoEmAndamentoError, sincronizarPessoas } from './sync/sync.engine';

/**
 * Configuração da conexão com o provedor de identidade.
 *
 * Este serviço não sincroniza nada — só guarda credencial e diz se ela
 * funciona. É deliberado: a Fase A inteira não toca em um único registro
 * operacional, e é o que permite instalar, conectar e conferir antes de
 * autorizar qualquer efeito.
 */

export class DiretorioDesabilitadoError extends Error {}
export class SemEmpresaAtivaError extends Error {}
export class ConexaoNaoEncontradaError extends Error {}
export class ConexaoDuplicadaError extends Error {}
export class EquipePadraoInvalidaError extends Error {}
export class SegredoObrigatorioError extends Error {}
export class ConexaoComVinculosError extends Error {
  constructor(message: string, readonly detalhes: { pessoas: number; vinculos: number }) {
    super(message);
  }
}

/// Flags de sincronização por empresa. O ambiente define o valor inicial de
/// cada uma; a empresa ajusta a partir dali.
export const opcoesSchema = z.object({
  sincronizarUsuarios: z.boolean(),
  sincronizarDepartamentos: z.boolean(),
  sincronizarCargos: z.boolean(),
  sincronizarGestores: z.boolean(),
  sincronizarFotos: z.boolean(),
  sincronizarGrupos: z.boolean(),
  sincronizarUsuariosDesabilitados: z.boolean(),
  /// As duas únicas flags que alcançam dado operacional.
  autoCriarColaboradores: z.boolean(),
  autoDesativarColaboradores: z.boolean(),
  logOperacoes: z.boolean(),
  sincronizacaoCompletaNaPrimeira: z.boolean(),
  intervaloMinutos: z.coerce.number().int().min(15).max(1440),
  paisPadrao: z.string().trim().max(80),
  fusoHorarioPadrao: z.string().trim().max(80),
  idiomaPadrao: z.string().trim().max(20),
});

export type OpcoesDiretorio = z.infer<typeof opcoesSchema>;

/// GUID do Entra. Validar aqui poupa uma ida ao Microsoft para descobrir que
/// alguém colou o nome do domínio no lugar do Directory ID — que é, de longe,
/// o erro de preenchimento mais comum dessa tela.
const guid = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Informe o GUID (formato 00000000-0000-0000-0000-000000000000), não o nome do domínio');

export const conexaoSchema = z.object({
  provider: z.enum(['entra', 'google', 'okta', 'ldap']).default('entra'),
  nome: z.string().trim().min(2, 'Dê um nome para identificar esta conexão'),
  ativo: z.boolean().default(false),
  provedorTenantId: guid,
  clientId: guid,
  clientSecret: z.string().trim().min(8, 'Informe o segredo do cliente (o campo "Value" no portal do Entra)'),
  authorityUrl: z.string().trim().url('Informe uma URL válida').optional().nullable(),
  equipePadraoId: z.coerce.number().int().positive().optional().nullable(),
  opcoes: opcoesSchema.partial().optional(),
});

/// Na edição tudo é opcional, inclusive o segredo: quem só troca uma flag não
/// deveria precisar recadastrar a credencial (nem teria como — ela nunca sai
/// da API para ser reenviada).
export const conexaoUpdateSchema = conexaoSchema.partial().extend({
  clientSecret: z.string().trim().min(8, 'Informe o segredo do cliente').optional(),
});

export type ConexaoInput = z.infer<typeof conexaoSchema>;
export type ConexaoUpdateInput = z.infer<typeof conexaoUpdateSchema>;

function exigirTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new SemEmpresaAtivaError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

/// Exportada porque o controller precisa dela ANTES de validar o corpo: com o
/// módulo desligado, responder "dados inválidos" mandaria quem chama depurar o
/// payload quando o problema é o recurso não existir neste ambiente.
export function exigirModuloHabilitado() {
  if (!env.enableEntraSync) {
    throw new DiretorioDesabilitadoError(
      'A sincronização com diretório está desligada neste ambiente. Defina ENABLE_ENTRA_SYNC=true no backend para habilitá-la.'
    );
  }
}

/// Completa as flags ausentes com o padrão do ambiente. Uma conexão salva
/// antes de uma flag existir continua válida — a nova entra com o padrão.
export function normalizarOpcoesPublicas(valor: unknown): OpcoesDiretorio {
  return normalizarOpcoes(valor);
}

function normalizarOpcoes(valor: unknown): OpcoesDiretorio {
  const bruto = (valor ?? {}) as Record<string, unknown>;
  return opcoesSchema.parse({ ...directoryDefaults, ...bruto });
}

type ConexaoComEquipe = DirectoryConnection & { equipePadrao?: { id: number; nome: string } | null };

/**
 * Forma pública da conexão. O segredo NUNCA sai daqui: o que vai para a tela
 * é a confirmação de que existe um segredo salvo e uma impressão digital de
 * 8 caracteres, suficiente para conferir "é o mesmo que cadastrei?" e curta
 * demais para servir de alavanca.
 */
export function apresentarConexao(conexao: ConexaoComEquipe) {
  let segredoImpressao: string | null = null;
  let segredoIlegivel = false;

  try {
    segredoImpressao = impressaoDigital(decifrar(conexao.clientSecretCifrado, contextoDaConexao(conexao.tenantId)));
  } catch {
    // Acontece quando DIRECTORY_ENCRYPTION_KEY mudou depois da gravação.
    // A tela precisa saber para pedir o recadastro em vez de mostrar um
    // "configurado" que não funciona.
    segredoIlegivel = true;
  }

  return {
    id: conexao.id,
    provider: conexao.provider,
    nome: conexao.nome,
    ativo: conexao.ativo,
    provedorTenantId: conexao.provedorTenantId,
    clientId: conexao.clientId,
    authorityUrl: conexao.authorityUrl,
    segredoImpressao,
    segredoIlegivel,
    equipePadrao: conexao.equipePadrao ?? null,
    opcoes: normalizarOpcoes(conexao.opcoes),
    ultimaSincronizacaoEm: conexao.ultimaSincronizacaoEm,
    ultimoTesteEm: conexao.ultimoTesteEm,
    ultimoTesteOk: conexao.ultimoTesteOk,
    ultimoErro: conexao.ultimoErro,
    createdAt: conexao.createdAt,
    updatedAt: conexao.updatedAt,
  };
}

export async function listarConexoes(user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);
  const conexoes = await directoryRepository.listarConexoes(tenantId);
  return conexoes.map(apresentarConexao);
}

async function validarEquipePadrao(tenantId: number, equipePadraoId: number | null | undefined, autoCriar: boolean) {
  if (equipePadraoId != null) {
    const equipe = await directoryRepository.equipeExiste(tenantId, equipePadraoId);
    if (!equipe) throw new EquipePadraoInvalidaError('A equipe padrão informada não existe nesta empresa');
    return;
  }

  // `colaboradores.equipe_id` é NOT NULL e o diretório não conhece equipes
  // operacionais — sem equipe de entrada não há como criar colaborador.
  if (autoCriar) {
    throw new EquipePadraoInvalidaError(
      'Para criar colaboradores automaticamente é preciso escolher uma equipe de entrada: o diretório não sabe a que equipe operacional cada pessoa pertence.'
    );
  }
}

export async function criarConexao(data: ConexaoInput, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const existente = await directoryRepository.buscarConexaoPorProvedor(tenantId, data.provider);
  if (existente) {
    throw new ConexaoDuplicadaError('Esta empresa já tem uma conexão com este provedor. Edite a existente.');
  }

  const opcoes = normalizarOpcoes(data.opcoes);
  await validarEquipePadrao(tenantId, data.equipePadraoId, opcoes.autoCriarColaboradores);

  const conexao = await directoryRepository.criarConexao(tenantId, {
    provider: data.provider,
    nome: data.nome,
    ativo: data.ativo,
    provedorTenantId: data.provedorTenantId,
    clientId: data.clientId,
    clientSecretCifrado: cifrar(data.clientSecret, contextoDaConexao(tenantId)),
    authorityUrl: data.authorityUrl ?? null,
    equipePadraoId: data.equipePadraoId ?? null,
    opcoes: opcoes as unknown as Prisma.InputJsonValue,
  });

  return apresentarConexao(conexao);
}

export async function atualizarConexao(id: number, data: ConexaoUpdateInput, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const atual = await directoryRepository.buscarConexao(tenantId, id);
  if (!atual) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const opcoes = normalizarOpcoes({ ...normalizarOpcoes(atual.opcoes), ...(data.opcoes ?? {}) });
  const equipePadraoId = data.equipePadraoId !== undefined ? data.equipePadraoId : atual.equipePadraoId;
  await validarEquipePadrao(tenantId, equipePadraoId, opcoes.autoCriarColaboradores);

  const mudancas: Prisma.DirectoryConnectionUncheckedUpdateInput = {
    nome: data.nome ?? atual.nome,
    ativo: data.ativo ?? atual.ativo,
    provedorTenantId: data.provedorTenantId ?? atual.provedorTenantId,
    clientId: data.clientId ?? atual.clientId,
    authorityUrl: data.authorityUrl !== undefined ? data.authorityUrl : atual.authorityUrl,
    equipePadraoId: equipePadraoId ?? null,
    opcoes: opcoes as unknown as Prisma.InputJsonValue,
  };

  // Segredo só é reescrito quando vem um novo. Ausente = mantém o que está lá.
  if (data.clientSecret) {
    mudancas.clientSecretCifrado = cifrar(data.clientSecret, contextoDaConexao(tenantId));
  }

  // Trocar credencial ou endpoint invalida o resultado do último teste — o
  // "verde" de antes não diz nada sobre a configuração de agora.
  const credencialMudou =
    Boolean(data.clientSecret) ||
    (data.clientId != null && data.clientId !== atual.clientId) ||
    (data.provedorTenantId != null && data.provedorTenantId !== atual.provedorTenantId) ||
    (data.authorityUrl !== undefined && data.authorityUrl !== atual.authorityUrl);

  if (credencialMudou) {
    mudancas.ultimoTesteEm = null;
    mudancas.ultimoTesteOk = null;
    mudancas.ultimoErro = null;
  }

  const atualizada = await directoryRepository.atualizarConexao(tenantId, id, mudancas);
  if (!atualizada) throw new ConexaoNaoEncontradaError('Conexão não encontrada');
  return apresentarConexao(atualizada);
}

export async function removerConexao(id: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const atual = await directoryRepository.buscarConexao(tenantId, id);
  if (!atual) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const [pessoas, vinculos] = await directoryRepository.contarVinculos(tenantId, id);
  if (vinculos > 0) {
    throw new ConexaoComVinculosError(
      `Esta conexão tem ${vinculos} pessoa(s) vinculada(s) a colaboradores. Desfaça os vínculos antes de removê-la, ou apenas desative a conexão para parar de sincronizar sem perder o que já foi associado.`,
      { pessoas, vinculos }
    );
  }

  await directoryRepository.removerConexao(tenantId, id);
  return apresentarConexao(atual);
}

/**
 * Roda o diagnóstico contra o provedor.
 *
 * Aceita um segredo avulso para testar ANTES de salvar: quem está montando a
 * App Registration erra na primeira tentativa quase sempre, e obrigar a
 * gravar credencial errada para descobrir que está errada é um mau negócio.
 */
export async function testarConexao(
  id: number | null,
  segredoAvulso: string | undefined,
  dadosAvulsos: { provider?: ConexaoInput['provider']; provedorTenantId?: string; clientId?: string; authorityUrl?: string | null } | undefined,
  user?: JwtPayload
): Promise<ResultadoDoTeste> {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  let provider: ConexaoInput['provider'] = dadosAvulsos?.provider ?? 'entra';
  let provedorTenantId = dadosAvulsos?.provedorTenantId ?? '';
  let clientId = dadosAvulsos?.clientId ?? '';
  let authorityUrl = dadosAvulsos?.authorityUrl ?? null;
  let clientSecret = segredoAvulso ?? '';

  if (id != null) {
    const conexao = await directoryRepository.buscarConexao(tenantId, id);
    if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

    provider = conexao.provider;
    provedorTenantId = dadosAvulsos?.provedorTenantId || conexao.provedorTenantId;
    clientId = dadosAvulsos?.clientId || conexao.clientId;
    authorityUrl = dadosAvulsos?.authorityUrl !== undefined ? dadosAvulsos.authorityUrl : conexao.authorityUrl;
    if (!clientSecret) clientSecret = decifrar(conexao.clientSecretCifrado, contextoDaConexao(tenantId));
  }

  if (!clientSecret) {
    throw new SegredoObrigatorioError('Informe o segredo do cliente para testar a conexão');
  }

  const resultado = await criarProvider(provider, { tenantId: provedorTenantId, clientId, clientSecret, authorityUrl }).testarConexao();

  // Testar uma conexão já salva registra o resultado; testar um rascunho não
  // tem onde registrar, e não deveria mexer no estado de nada.
  if (id != null) {
    const erro = resultado.erro ?? resultado.verificacoes.find((v) => v.obrigatoria && !v.ok)?.detalhe ?? null;
    await directoryRepository.registrarTeste(tenantId, id, resultado.ok, erro);
  }

  return resultado;
}

// ---------------------------------------------------------------- espelho

export class ConexaoInativaError extends Error {}

/// Monta o provedor a partir de uma conexão salva, decifrando o segredo.
async function providerDaConexao(tenantId: number, id: number) {
  const conexao = await directoryRepository.buscarConexao(tenantId, id);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const opcoes = normalizarOpcoes(conexao.opcoes);
  const provider = criarProvider(conexao.provider, {
    tenantId: conexao.provedorTenantId,
    clientId: conexao.clientId,
    clientSecret: decifrar(conexao.clientSecretCifrado, contextoDaConexao(tenantId)),
    authorityUrl: conexao.authorityUrl,
  });

  return { conexao, opcoes, provider };
}

/**
 * Dispara a carga do diretório para o espelho.
 *
 * Nada aqui alcança colaborador, equipe ou escala: o motor só escreve em
 * `diretorio_*`. É o que permite rodar isto em produção antes de autorizar
 * qualquer efeito sobre o cadastro.
 */
export async function sincronizarDiretorio(id: number, forcarCompleta = false, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const { conexao, opcoes, provider } = await providerDaConexao(tenantId, id);

  if (!conexao.ativo) {
    throw new ConexaoInativaError(
      'Esta conexão está inativa. Ative-a antes de sincronizar — inativa ela mantém o que já foi lido, mas não busca nada novo.'
    );
  }

  if (!opcoes.sincronizarUsuarios) {
    throw new ConexaoInativaError('A leitura de pessoas está desligada nas opções desta conexão.');
  }

  return sincronizarPessoas({
    tenantId,
    connectionId: conexao.id,
    provider,
    cursor: conexao.cursorPessoas,
    // `completa` é uma escolha de quem clica: "esqueça o cursor e releia tudo".
    // Sem isso, uma divergência suspeita não teria como ser resolvida pela tela.
    modo: forcarCompleta ? 'completa' : 'auto',
    incluirDesabilitados: opcoes.sincronizarUsuariosDesabilitados,
    logOperacoes: opcoes.logOperacoes,
    disparadoPorId: user?.userId ?? null,
    sincronizarGestores: opcoes.sincronizarGestores,
    sincronizarGrupos: opcoes.sincronizarGrupos,
    autoCriarColaboradores: opcoes.autoCriarColaboradores,
    autoDesativarColaboradores: opcoes.autoDesativarColaboradores,
    equipePadraoId: conexao.equipePadraoId,
  });
}

export const filtroDePessoasSchema = z.object({
  conexaoId: z.coerce.number().int().positive(),
  busca: z.string().trim().max(120).optional(),
  departamento: z.string().trim().max(120).optional(),
  incluirRemovidos: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export async function listarPessoasDoEspelho(filtros: z.infer<typeof filtroDePessoasSchema>, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, filtros.conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  return directoryRepository.listarPessoas(tenantId, conexao.id, filtros);
}

export async function resumoDoDiretorio(conexaoId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const [[presentes, desabilitadas, removidas, vinculadas], [departamentos, cargos], execucoes] = await Promise.all([
    directoryRepository.resumoDoEspelho(tenantId, conexao.id),
    directoryRepository.listarCatalogos(tenantId, conexao.id),
    directoryRepository.listarExecucoes(tenantId, conexao.id, 10),
  ]);

  return {
    contadores: { presentes, desabilitadas, removidas, vinculadas },
    departamentos,
    cargos,
    execucoes,
  };
}

export { ChaveDeCifragemAusenteError, ProvedorNaoSuportadoError, SincronizacaoEmAndamentoError };
