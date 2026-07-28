import type { Collaborator } from '@prisma/client';
import { collaboratorRepository } from '../../../repositories/collaborator.repository';
import { directoryRepository } from '../directory.repository';

/**
 * A ponte entre o diretório e a operação.
 *
 * Este é o ÚNICO arquivo do módulo autorizado a escrever em tabela
 * operacional, e o teste de isolamento existe para manter assim: qualquer
 * outro arquivo que importe repositório de colaborador ou equipe quebra o
 * build.
 *
 * Concentrar a travessia num lugar só é o que torna a promessa verificável.
 * "A sincronização não sobrescreve dado operacional" não é uma intenção
 * espalhada por dez arquivos: é uma lista de campos, neste arquivo, que cabe
 * numa tela e pode ser revisada por alguém que não escreveu o código.
 */

// ---------------------------------------------------------------------------
// A lista fechada
// ---------------------------------------------------------------------------

export type PessoaParaReconciliar = {
  id: number;
  externalId: string;
  nomeExibicao: string;
  email: string | null;
  cargo: string | null;
  telefone: string | null;
  celular: string | null;
  contaHabilitada: boolean;
  removidoEm: Date | null;
  colaboradorId: number | null;
  camposBloqueados: string[];
};

/**
 * Campos que o diretório MANDA: reescritos a cada reconciliação.
 *
 * São os que descrevem a pessoa, não o vínculo dela com a operação. Se o RH
 * corrigir um deles à mão, a próxima sincronização desfaz — e é por isso que
 * existe a trava por campo.
 */
const DO_DIRETORIO = {
  nome: (pessoa: PessoaParaReconciliar) => pessoa.nomeExibicao,
  email: (pessoa: PessoaParaReconciliar) => pessoa.email,
  cargo: (pessoa: PessoaParaReconciliar) => pessoa.cargo,
} as const;

/**
 * Campos que o diretório só PREENCHE quando estão vazios.
 *
 * Telefone de diretório corporativo costuma ser o ramal de dez anos atrás.
 * Sobrescrever um celular que o RH acabou de corrigir seria regressão; deixar
 * o cadastro vazio quando o diretório tem algo também é desperdício.
 */
const SE_VAZIO = {
  telefone: (pessoa: PessoaParaReconciliar) => pessoa.telefone ?? pessoa.celular,
} as const;

/**
 * Tudo que a reconciliação NUNCA toca.
 *
 * Não é usada em código — a proteção vem de os campos simplesmente não
 * aparecerem nos mapas acima. Está aqui para ser lida: é a resposta escrita à
 * pergunta "o que a sincronização pode estragar no meu cadastro?".
 */
export const NUNCA_TOCADOS = [
  'equipeId',
  'tipoContrato',
  'modeloTrabalho',
  'fazPlantao',
  'sobreAviso',
  // Estes três decidem cálculo de férias e rescisão. Nenhum diretório de
  // identidade sabe deles.
  'dataAdmissao',
  'dataDesligamento',
  'dataNascimento',
  'matricula',
  'cpf',
] as const;

/// Campos que a tela pode travar. `ativo` entra na lista porque a
/// auto-desativação também é sobrescrita — e alguém que desativou um
/// colaborador por motivo operacional precisa poder impedir a volta.
export const CAMPOS_TRAVAVEIS = [...Object.keys(DO_DIRETORIO), ...Object.keys(SE_VAZIO), 'ativo'] as const;

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

export type MudancaDeCampo = { campo: string; de: unknown; para: unknown };

/**
 * O que mudaria no colaborador, sem gravar nada.
 *
 * Separado da gravação de propósito: assim a mesma função serve à
 * pré-visualização na tela e à aplicação de verdade, e não há risco de a
 * prévia mostrar uma coisa e o efeito ser outro.
 */
export function calcularMudancas(
  pessoa: PessoaParaReconciliar,
  colaborador: Pick<Collaborator, 'nome' | 'email' | 'cargo' | 'telefone' | 'ativo'>,
  opcoes: { autoDesativar: boolean }
): MudancaDeCampo[] {
  const travados = new Set(pessoa.camposBloqueados);
  const mudancas: MudancaDeCampo[] = [];

  for (const [campo, extrair] of Object.entries(DO_DIRETORIO)) {
    if (travados.has(campo)) continue;

    const novo = extrair(pessoa);
    const atual = colaborador[campo as keyof typeof colaborador];
    // Nulo do diretório não apaga o que o cadastro tem: ausência de informação
    // não é informação de ausência.
    if (novo == null || novo === atual) continue;
    mudancas.push({ campo, de: atual, para: novo });
  }

  for (const [campo, extrair] of Object.entries(SE_VAZIO)) {
    if (travados.has(campo)) continue;

    const atual = colaborador[campo as keyof typeof colaborador];
    if (atual != null && String(atual).trim() !== '') continue;

    const novo = extrair(pessoa);
    if (novo == null) continue;
    mudancas.push({ campo, de: atual, para: novo });
  }

  if (opcoes.autoDesativar && !travados.has('ativo')) {
    // Saiu do diretório ou teve a conta desabilitada: perde acesso, mas NÃO é
    // desligamento. `dataDesligamento` continua sendo ato humano — gravá-la
    // aqui truncaria o período aquisitivo e reduziria direito a férias em
    // silêncio.
    const deveEstarAtivo = pessoa.contaHabilitada && pessoa.removidoEm == null;
    if (colaborador.ativo !== deveEstarAtivo) {
      mudancas.push({ campo: 'ativo', de: colaborador.ativo, para: deveEstarAtivo });
    }
  }

  return mudancas;
}

// ---------------------------------------------------------------------------
// Aplicação
// ---------------------------------------------------------------------------

export type ResultadoDaReconciliacao = {
  atualizados: number;
  criados: number;
  desativados: number;
  reativados: number;
  conflitos: Array<{ externalId: string; nome: string; motivo: string }>;
  mudancas: Array<{ externalId: string; colaboradorId: number; campos: MudancaDeCampo[] }>;
};

function vazio(): ResultadoDaReconciliacao {
  return { atualizados: 0, criados: 0, desativados: 0, reativados: 0, conflitos: [], mudancas: [] };
}

/**
 * Aplica o diretório sobre os colaboradores já vinculados.
 *
 * Só mexe em quem tem vínculo: pessoa sem `colaboradorId` não existe para a
 * operação, e criar colaborador é decisão à parte (ver `promover`).
 */
export async function reconciliarVinculados(params: {
  tenantId: number;
  connectionId: number;
  autoDesativar: boolean;
}): Promise<ResultadoDaReconciliacao> {
  const resultado = vazio();
  const pessoas = await directoryRepository.pessoasVinculadas(params.tenantId, params.connectionId);

  for (const pessoa of pessoas) {
    if (pessoa.colaboradorId == null) continue;

    const colaborador = await collaboratorRepository.findById(params.tenantId, pessoa.colaboradorId);
    if (!colaborador) {
      // O colaborador foi apagado e o `ON DELETE SET NULL` ainda não refletiu,
      // ou o vínculo aponta para outra empresa. Não é para acontecer; se
      // acontecer, é para aparecer.
      resultado.conflitos.push({
        externalId: pessoa.externalId,
        nome: pessoa.nomeExibicao,
        motivo: 'O colaborador vinculado não existe mais nesta empresa',
      });
      continue;
    }

    const mudancas = calcularMudancas(pessoa, colaborador, { autoDesativar: params.autoDesativar });
    if (mudancas.length === 0) continue;

    const dados = Object.fromEntries(mudancas.map((mudanca) => [mudanca.campo, mudanca.para]));

    try {
      await collaboratorRepository.update(params.tenantId, colaborador.id, dados);
    } catch (erro) {
      // O caso real: `colaboradores` tem unique (tenant, email), e dois
      // registros do diretório podem convergir para o mesmo endereço quando um
      // e-mail é reciclado. Vira conflito para decisão humana, nunca uma
      // gravação forçada.
      resultado.conflitos.push({
        externalId: pessoa.externalId,
        nome: pessoa.nomeExibicao,
        motivo: erro instanceof Error ? erro.message : 'Falha ao atualizar o colaborador',
      });
      continue;
    }

    resultado.atualizados += 1;
    resultado.mudancas.push({ externalId: pessoa.externalId, colaboradorId: colaborador.id, campos: mudancas });

    const ativo = mudancas.find((mudanca) => mudanca.campo === 'ativo');
    if (ativo?.para === false) resultado.desativados += 1;
    if (ativo?.para === true) resultado.reativados += 1;
  }

  return resultado;
}

/**
 * Cria colaboradores para quem ainda não tem, quando a empresa optou por isso.
 *
 * Duas recusas deliberadas:
 *
 * - **Conta desabilitada não vira colaborador.** Criar cadastro para quem já
 *   perdeu o acesso só polui a lista de escala.
 * - **E-mail que já existe em outro colaborador vira conflito, não vínculo.**
 *   Ligar por e-mail automaticamente é o que a especificação proíbe: e-mail é
 *   reciclado, e o vínculo errado entrega o histórico de uma pessoa a outra. A
 *   decisão fica para um humano, na tela.
 */
export async function criarColaboradoresAutomaticamente(params: {
  tenantId: number;
  connectionId: number;
  equipePadraoId: number;
}): Promise<ResultadoDaReconciliacao> {
  const resultado = vazio();
  const pessoas = await directoryRepository.pessoasSemVinculo(params.tenantId, params.connectionId);

  for (const pessoa of pessoas) {
    if (!pessoa.contaHabilitada || pessoa.removidoEm != null) continue;

    if (!pessoa.email) {
      resultado.conflitos.push({
        externalId: pessoa.externalId,
        nome: pessoa.nomeExibicao,
        motivo: 'Sem e-mail no diretório — o cadastro de colaborador exige um',
      });
      continue;
    }

    const existente = await collaboratorRepository.findByEmail(params.tenantId, pessoa.email);
    if (existente) {
      resultado.conflitos.push({
        externalId: pessoa.externalId,
        nome: pessoa.nomeExibicao,
        motivo: `Já existe o colaborador "${existente.nome}" com este e-mail. Vincule manualmente para confirmar que é a mesma pessoa.`,
      });
      continue;
    }

    try {
      const colaborador = await criarColaborador(params.tenantId, pessoa, params.equipePadraoId);
      await directoryRepository.vincular(params.tenantId, pessoa.id, colaborador.id);
      resultado.criados += 1;
    } catch (erro) {
      resultado.conflitos.push({
        externalId: pessoa.externalId,
        nome: pessoa.nomeExibicao,
        motivo: erro instanceof Error ? erro.message : 'Falha ao criar o colaborador',
      });
    }
  }

  return resultado;
}

/**
 * Cria o colaborador a partir da pessoa do diretório.
 *
 * Os campos que o diretório não conhece recebem o padrão mais conservador —
 * CLT presencial sem plantão nem sobreaviso — porque entrar na escala de
 * plantão por omissão seria pior que ter de corrigir depois. `dataAdmissao`
 * fica vazia de propósito: o diretório não sabe quando a pessoa foi contratada,
 * e chutar essa data corromperia o cálculo de férias.
 */
async function criarColaborador(tenantId: number, pessoa: PessoaParaReconciliar, equipeId: number) {
  return collaboratorRepository.create(tenantId, {
    nome: pessoa.nomeExibicao,
    email: pessoa.email!,
    telefone: pessoa.telefone ?? pessoa.celular ?? '',
    cargo: pessoa.cargo ?? 'A definir',
    equipeId,
    tipoContrato: 'clt',
    modeloTrabalho: 'presencial',
    fazPlantao: false,
    sobreAviso: false,
    ativo: true,
  });
}

// ---------------------------------------------------------------------------
// Operações de um só vínculo
//
// Ficam aqui, e não num serviço de borda, porque tocam repositório operacional
// — e este é o único arquivo do módulo com essa licença. O serviço de borda
// orquestra chamando estas funções.
// ---------------------------------------------------------------------------

export function buscarColaborador(tenantId: number, colaboradorId: number) {
  return collaboratorRepository.findById(tenantId, colaboradorId);
}

export function buscarColaboradorPorEmail(tenantId: number, email: string) {
  return collaboratorRepository.findByEmail(tenantId, email);
}

/// Colaboradores da empresa, enxutos para alimentar o seletor de vínculo.
export async function listarColaboradoresParaVinculo(tenantId: number) {
  const colaboradores = await collaboratorRepository.findAll(tenantId);
  return colaboradores.map((colaborador) => ({
    id: colaborador.id,
    nome: colaborador.nome,
    email: colaborador.email,
    cargo: colaborador.cargo,
    ativo: colaborador.ativo,
    equipe: colaborador.equipe ? { id: colaborador.equipe.id, nome: colaborador.equipe.nome } : null,
  }));
}

/**
 * Aplica o diretório sobre UM colaborador.
 *
 * Usada no vínculo manual, para que o efeito aconteça na hora em vez de só na
 * próxima sincronização — quem acabou de vincular quer ver o resultado.
 */
export async function aplicarEmUm(
  tenantId: number,
  pessoa: PessoaParaReconciliar,
  colaborador: Pick<Collaborator, 'id' | 'nome' | 'email' | 'cargo' | 'telefone' | 'ativo'>,
  opcoes: { autoDesativar: boolean }
): Promise<MudancaDeCampo[]> {
  const mudancas = calcularMudancas(pessoa, colaborador, opcoes);
  if (mudancas.length === 0) return [];

  await collaboratorRepository.update(
    tenantId,
    colaborador.id,
    Object.fromEntries(mudancas.map((mudanca) => [mudanca.campo, mudanca.para]))
  );
  return mudancas;
}

export { criarColaborador };
