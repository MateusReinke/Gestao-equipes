import type { JwtPayload } from '../../types/auth';
import { directoryRepository } from './directory.repository';
import {
  ConexaoNaoEncontradaError,
  SemEmpresaAtivaError,
  exigirModuloHabilitado,
} from './directory.service';

/**
 * Organograma e grupos — leitura pura.
 *
 * Nada aqui escreve em lugar nenhum. O organograma é o `manager` do Entra
 * desenhado como árvore, e a sugestão de responsáveis é uma contagem sobre essa
 * árvore. Confirmar a sugestão é ato de gente, na tela de Equipes.
 */

export type NoDoOrganograma = {
  id: number;
  externalId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  contaHabilitada: boolean;
  vinculada: boolean;
  /// Quantas pessoas reportam a esta, direta e indiretamente.
  totalAbaixo: number;
  subordinados: NoDoOrganograma[];
};

function exigirTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new SemEmpresaAtivaError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

/**
 * Monta a árvore a partir de `gestorExternalId`.
 *
 * Duas defesas contra dado sujo, porque diretório corporativo tem os dois
 * casos com frequência incômoda:
 *
 * - **Gestor que não existe no espelho** (saiu da empresa, ou está fora do
 *   filtro de leitura): a pessoa vira raiz em vez de sumir da árvore.
 * - **Ciclo** (A reporta a B que reporta a A): a aresta que fecharia o ciclo é
 *   ignorada e quem sobra vira raiz. Sem isso, a montagem entraria em recursão
 *   infinita.
 */
export function montarArvore(
  pessoas: Array<{
    id: number;
    externalId: string;
    nomeExibicao: string;
    cargo: string | null;
    departamento: string | null;
    gestorExternalId: string | null;
    contaHabilitada: boolean;
    colaboradorId: number | null;
  }>
): { raizes: NoDoOrganograma[]; semGestor: number; orfaos: number; ciclos: number } {
  const nos = new Map<string, NoDoOrganograma>();
  for (const pessoa of pessoas) {
    nos.set(pessoa.externalId, {
      id: pessoa.id,
      externalId: pessoa.externalId,
      nome: pessoa.nomeExibicao,
      cargo: pessoa.cargo,
      departamento: pessoa.departamento,
      contaHabilitada: pessoa.contaHabilitada,
      vinculada: pessoa.colaboradorId != null,
      totalAbaixo: 0,
      subordinados: [],
    });
  }

  const raizes: NoDoOrganograma[] = [];
  let semGestor = 0;
  let orfaos = 0;
  let ciclos = 0;

  /// Sobe a cadeia de chefia a partir de um candidato a gestor: se chegar de
  /// volta na própria pessoa, a aresta fecharia um ciclo.
  function fecharia(externalId: string, candidato: string): boolean {
    const visitados = new Set<string>();
    let atual: string | undefined = candidato;

    while (atual) {
      if (atual === externalId) return true;
      if (visitados.has(atual)) return true;
      visitados.add(atual);
      atual = pessoas.find((pessoa) => pessoa.externalId === atual)?.gestorExternalId ?? undefined;
    }
    return false;
  }

  for (const pessoa of pessoas) {
    const no = nos.get(pessoa.externalId)!;

    if (!pessoa.gestorExternalId) {
      semGestor += 1;
      raizes.push(no);
      continue;
    }

    const gestor = nos.get(pessoa.gestorExternalId);
    if (!gestor) {
      orfaos += 1;
      raizes.push(no);
      continue;
    }

    if (fecharia(pessoa.externalId, pessoa.gestorExternalId)) {
      ciclos += 1;
      raizes.push(no);
      continue;
    }

    gestor.subordinados.push(no);
  }

  /// Conta a subárvore. Iterativo seria mais defensivo, mas os ciclos já foram
  /// eliminados acima — a recursão aqui é sobre uma floresta, não um grafo.
  function contar(no: NoDoOrganograma): number {
    no.totalAbaixo = no.subordinados.reduce((soma, filho) => soma + 1 + contar(filho), 0);
    return no.totalAbaixo;
  }
  raizes.forEach(contar);

  return { raizes, semGestor, orfaos, ciclos };
}

export async function organograma(conexaoId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const pessoas = await directoryRepository.arvoreDeGestores(tenantId, conexao.id);
  const { raizes, semGestor, orfaos, ciclos } = montarArvore(pessoas);

  return {
    raizes,
    resumo: { pessoas: pessoas.length, semGestor, orfaos, ciclos },
  };
}

export async function grupos(conexaoId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const lista = await directoryRepository.listarGrupos(tenantId, conexao.id);
  return lista.map((grupo) => ({
    id: grupo.id,
    externalId: grupo.externalId,
    nome: grupo.nome,
    descricao: grupo.descricao,
    email: grupo.email,
    tipo: grupo.tipo,
    membros: grupo._count.membros,
    removidoEm: grupo.removidoEm,
  }));
}

/**
 * Quem o organograma sugere como responsável por cada equipe.
 *
 * A conta é simples e a interpretação é o que importa: para cada equipe, olha
 * os colaboradores dela, encontra as pessoas do diretório correspondentes e vê
 * a quem elas reportam. Quem for gestor de mais gente da equipe é o candidato.
 *
 * **Sugestão, nunca aplicação.** `manager` do Entra é pessoa → pessoa
 * (hierarquia de RH); `gestor_equipes` é usuário → equipe (quem responde pela
 * operação). O gestor de RH de um analista pode não ser o responsável pela
 * escala de plantão dele, e aplicar isso automaticamente daria visibilidade e
 * notificações a quem não deveria tê-las.
 */
export async function sugestoesDeResponsavel(conexaoId: number, user?: JwtPayload) {
  exigirModuloHabilitado();
  const tenantId = exigirTenant(user);

  const conexao = await directoryRepository.buscarConexao(tenantId, conexaoId);
  if (!conexao) throw new ConexaoNaoEncontradaError('Conexão não encontrada');

  const [pessoas, vinculos] = await Promise.all([
    directoryRepository.arvoreDeGestores(tenantId, conexao.id),
    directoryRepository.equipesDosVinculados(tenantId, conexao.id),
  ]);

  const porExternalId = new Map(pessoas.map((pessoa) => [pessoa.externalId, pessoa]));
  const colaboradorPorExternalId = new Map(
    pessoas.filter((pessoa) => pessoa.colaboradorId != null).map((pessoa) => [pessoa.externalId, pessoa.colaboradorId!])
  );

  // Quantas pessoas de cada equipe reportam a cada gestor.
  const contagem = new Map<number, Map<string, number>>();

  for (const vinculo of vinculos) {
    const pessoa = pessoas.find((item) => item.colaboradorId === vinculo.colaboradorId);
    const gestorExternalId = pessoa?.gestorExternalId;
    if (!gestorExternalId || !porExternalId.has(gestorExternalId)) continue;

    const daEquipe = contagem.get(vinculo.equipeId) ?? new Map<string, number>();
    daEquipe.set(gestorExternalId, (daEquipe.get(gestorExternalId) ?? 0) + 1);
    contagem.set(vinculo.equipeId, daEquipe);
  }

  const equipes = new Map(vinculos.map((vinculo) => [vinculo.equipeId, vinculo.equipeNome]));

  return [...contagem.entries()]
    .map(([equipeId, gestores]) => {
      const [externalId, quantos] = [...gestores.entries()].sort((a, b) => b[1] - a[1])[0];
      const gestor = porExternalId.get(externalId)!;

      return {
        equipe: { id: equipeId, nome: equipes.get(equipeId) ?? `Equipe ${equipeId}` },
        gestor: {
          externalId,
          nome: gestor.nomeExibicao,
          cargo: gestor.cargo,
          // Sem colaborador vinculado não há como chegar ao usuário do sistema,
          // e responsável por equipe é um USUÁRIO — a sugestão fica visível,
          // mas não acionável, e a tela explica por quê.
          colaboradorId: colaboradorPorExternalId.get(externalId) ?? null,
        },
        pessoasQueReportam: quantos,
      };
    })
    .sort((a, b) => b.pessoasQueReportam - a.pessoasQueReportam);
}
