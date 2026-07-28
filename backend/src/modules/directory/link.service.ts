import type { JwtPayload } from '../../types/auth';
import { directoryRepository } from './directory.repository';
import {
  ConexaoInativaError,
  ConexaoNaoEncontradaError,
  DiretorioDesabilitadoError,
  SemEmpresaAtivaError,
  exigirModuloHabilitado,
  normalizarOpcoesPublicas,
} from './directory.service';
import {
  CAMPOS_TRAVAVEIS,
  NUNCA_TOCADOS,
  aplicarEmUm,
  buscarColaborador,
  buscarColaboradorPorEmail,
  calcularMudancas,
  criarColaborador,
  listarColaboradoresParaVinculo,
  type MudancaDeCampo,
} from './sync/reconcile.service';

/**
 * Vincular, promover e desvincular.
 *
 * Este arquivo NÃO importa repositório operacional: tudo que alcança
 * colaborador passa por `sync/reconcile.service`, que é o único com essa
 * licença. Aqui mora só a orquestração e as regras de recusa.
 */

export class PessoaNaoEncontradaError extends Error {}
export class ColaboradorJaVinculadoError extends Error {}
export class ReconciliacaoInvalidaError extends Error {}

function exigirTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new SemEmpresaAtivaError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

async function pessoaDoTenant(tenantId: number, pessoaId: number) {
  const pessoa = await directoryRepository.buscarPessoa(tenantId, pessoaId);
  if (!pessoa) throw new PessoaNaoEncontradaError('Pessoa do diretório não encontrada nesta empresa');
  return pessoa;
}

/**
 * O que ainda precisa de decisão humana, e as pistas para tomá-la.
 *
 * As sugestões saem de coincidência de e-mail — e é importante o que ISSO NÃO
 * é: o vínculo persistido continua sendo por Object ID, sempre. O e-mail serve
 * de pista para uma pessoa confirmar, uma vez. Vincular por e-mail
 * automaticamente entregaria o histórico de alguém a outra pessoa no dia em
 * que um endereço fosse reciclado.
 */
export async function listarPendencias(conexaoId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const [semVinculo, colaboradores] = await Promise.all([
    directoryRepository.pessoasSemVinculo(tenantId, conexao.id),
    listarColaboradoresParaVinculo(tenantId),
  ]);

  const jaVinculados = new Set(
    (await directoryRepository.pessoasVinculadas(tenantId, conexao.id)).map((pessoa) => pessoa.colaboradorId)
  );

  const porEmail = new Map(
    colaboradores
      .filter((colaborador) => !jaVinculados.has(colaborador.id))
      .map((colaborador) => [colaborador.email.trim().toLowerCase(), colaborador])
  );

  const pendentes = semVinculo.map((pessoa) => ({
    id: pessoa.id,
    externalId: pessoa.externalId,
    nomeExibicao: pessoa.nomeExibicao,
    email: pessoa.email,
    cargo: pessoa.cargo,
    contaHabilitada: pessoa.contaHabilitada,
    sugestao: pessoa.email ? (porEmail.get(pessoa.email.trim().toLowerCase()) ?? null) : null,
  }));

  return {
    pendentes,
    colaboradoresDisponiveis: colaboradores.filter((colaborador) => !jaVinculados.has(colaborador.id)),
    camposTravaveis: [...CAMPOS_TRAVAVEIS],
    nuncaTocados: [...NUNCA_TOCADOS],
  };
}

/// Prévia do efeito, sem gravar. A mesma função de decisão que a aplicação usa
/// — é o que garante que a prévia não minta.
export async function previewDaPessoa(pessoaId: number, colaboradorId: number | null, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const pessoa = await pessoaDoTenant(tenantId, pessoaId);
  const alvo = colaboradorId ?? pessoa.colaboradorId;
  if (alvo == null) throw new ReconciliacaoInvalidaError('Informe o colaborador para simular o vínculo');

  const colaborador = await buscarColaborador(tenantId, alvo);
  if (!colaborador) throw new ReconciliacaoInvalidaError('Colaborador não encontrado nesta empresa');

  const conexao = await directoryRepository.buscarConexao(tenantId, pessoa.connectionId);
  const opcoes = normalizarOpcoesPublicas(conexao?.opcoes);

  return {
    pessoa: { id: pessoa.id, externalId: pessoa.externalId, nomeExibicao: pessoa.nomeExibicao },
    colaborador: { id: colaborador.id, nome: colaborador.nome },
    mudancas: calcularMudancas(pessoa, colaborador, { autoDesativar: opcoes.autoDesativarColaboradores }),
    camposBloqueados: pessoa.camposBloqueados,
  };
}

export async function vincularPessoa(pessoaId: number, colaboradorId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const pessoa = await pessoaDoTenant(tenantId, pessoaId);

  const colaborador = await buscarColaborador(tenantId, colaboradorId);
  if (!colaborador) throw new ReconciliacaoInvalidaError('Colaborador não encontrado nesta empresa');

  // Um colaborador com dois donos no diretório receberia gravações alternadas
  // a cada execução, e ninguém entenderia por que o cargo fica oscilando.
  const outra = await directoryRepository.outraPessoaComOMesmoColaborador(tenantId, colaboradorId, pessoaId);
  if (outra) {
    throw new ColaboradorJaVinculadoError(
      `Este colaborador já está vinculado a "${outra.nomeExibicao}" no diretório. Desfaça aquele vínculo primeiro.`
    );
  }

  await directoryRepository.vincular(tenantId, pessoa.id, colaboradorId);

  const conexao = await directoryRepository.buscarConexao(tenantId, pessoa.connectionId);
  const opcoes = normalizarOpcoesPublicas(conexao?.opcoes);

  // Aplica na hora: quem acabou de vincular quer ver o efeito, não descobrir na
  // próxima sincronização.
  const aplicado = await aplicarEmUm(tenantId, { ...pessoa, colaboradorId }, colaborador, {
    autoDesativar: opcoes.autoDesativarColaboradores,
  });

  return { pessoa, colaborador: { id: colaborador.id, nome: colaborador.nome }, aplicado };
}

/**
 * Cria um colaborador a partir da pessoa do diretório.
 *
 * A equipe é escolhida no ato, e não herdada de lugar nenhum: o diretório não
 * conhece equipes operacionais, e `colaboradores.equipe_id` é obrigatório.
 */
export async function promoverPessoa(pessoaId: number, equipeId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const pessoa = await pessoaDoTenant(tenantId, pessoaId);

  if (pessoa.colaboradorId != null) {
    throw new ReconciliacaoInvalidaError('Esta pessoa já está vinculada a um colaborador');
  }
  if (!pessoa.email) {
    throw new ReconciliacaoInvalidaError(
      'Esta pessoa não tem e-mail no diretório, e o cadastro de colaborador exige um. Crie o colaborador manualmente e depois vincule.'
    );
  }

  const equipe = await directoryRepository.equipeExiste(tenantId, equipeId);
  if (!equipe) throw new ReconciliacaoInvalidaError('A equipe informada não existe nesta empresa');

  const duplicado = await buscarColaboradorPorEmail(tenantId, pessoa.email);
  if (duplicado) {
    throw new ColaboradorJaVinculadoError(
      `Já existe o colaborador "${duplicado.nome}" com este e-mail. Se for a mesma pessoa, use "Vincular" em vez de criar.`
    );
  }

  const colaborador = await criarColaborador(tenantId, pessoa, equipeId);
  await directoryRepository.vincular(tenantId, pessoa.id, colaborador.id);

  return { pessoa, colaborador };
}

/**
 * Desfaz o vínculo.
 *
 * O colaborador permanece intocado — inclusive o que a sincronização já
 * escreveu nele. Desvincular significa "pare de atualizar", não "desfaça o que
 * foi feito": reverter exigiria saber o valor anterior de cada campo, e o
 * cadastro não é versionado.
 *
 * As travas de campo caem junto: elas descrevem o vínculo, e sem vínculo não
 * têm sobre o que valer.
 */
export async function desvincularPessoa(pessoaId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const pessoa = await pessoaDoTenant(tenantId, pessoaId);
  if (pessoa.colaboradorId == null) {
    throw new ReconciliacaoInvalidaError('Esta pessoa não está vinculada a nenhum colaborador');
  }

  const colaboradorId = pessoa.colaboradorId;
  await directoryRepository.desvincular(tenantId, pessoa.id);

  return { pessoa, colaboradorId };
}

export async function definirTravas(pessoaId: number, campos: string[], user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const pessoa = await pessoaDoTenant(tenantId, pessoaId);
  if (pessoa.colaboradorId == null) {
    throw new ReconciliacaoInvalidaError('Só faz sentido travar campos de uma pessoa vinculada a colaborador');
  }

  // Travar um campo que a sincronização nem escreve daria uma falsa sensação
  // de proteção — e esconderia que `dataAdmissao`, por exemplo, já é intocável
  // por construção.
  const invalidos = campos.filter((campo) => !CAMPOS_TRAVAVEIS.includes(campo as never));
  if (invalidos.length > 0) {
    throw new ReconciliacaoInvalidaError(
      `Estes campos não são escritos pela sincronização, então travá-los não teria efeito: ${invalidos.join(', ')}.`
    );
  }

  const camposBloqueados = [...new Set(campos)];
  await directoryRepository.definirCamposBloqueados(tenantId, pessoa.id, camposBloqueados);

  return { pessoa, camposBloqueados };
}

export type { MudancaDeCampo };
export { ConexaoInativaError, ConexaoNaoEncontradaError, DiretorioDesabilitadoError, SemEmpresaAtivaError };
