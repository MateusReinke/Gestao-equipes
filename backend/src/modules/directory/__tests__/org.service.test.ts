import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../directory.repository', () => ({
  directoryRepository: {
    buscarConexao: vi.fn(),
    arvoreDeGestores: vi.fn(),
    equipesDosVinculados: vi.fn(),
    listarGrupos: vi.fn(),
  },
}));

import { directoryRepository } from '../directory.repository';
import { montarArvore, sugestoesDeResponsavel } from '../org.service';

type Entrada = Parameters<typeof montarArvore>[0][number];

function p(externalId: string, gestorExternalId: string | null = null, extra: Partial<Entrada> = {}): Entrada {
  return {
    id: Number(externalId.replace(/\D/g, '')) || 0,
    externalId,
    nomeExibicao: `Pessoa ${externalId}`,
    cargo: null,
    departamento: null,
    gestorExternalId,
    contaHabilitada: true,
    colaboradorId: null,
    ...extra,
  };
}

describe('montagem do organograma', () => {
  it('desenha a hierarquia a partir de quem reporta a quem', () => {
    const { raizes } = montarArvore([p('a'), p('b', 'a'), p('c', 'a'), p('d', 'b')]);

    expect(raizes).toHaveLength(1);
    expect(raizes[0].externalId).toBe('a');
    expect(raizes[0].subordinados.map((no) => no.externalId).sort()).toEqual(['b', 'c']);
  });

  it('conta a subárvore inteira, não só os diretos', () => {
    const { raizes } = montarArvore([p('a'), p('b', 'a'), p('c', 'a'), p('d', 'b'), p('e', 'd')]);

    expect(raizes[0].totalAbaixo).toBe(4);
    const b = raizes[0].subordinados.find((no) => no.externalId === 'b')!;
    expect(b.totalAbaixo).toBe(2);
  });

  it('quem não tem gestor é raiz', () => {
    const { raizes, semGestor } = montarArvore([p('a'), p('b')]);

    expect(semGestor).toBe(2);
    expect(raizes).toHaveLength(2);
  });

  it('gestor fora do espelho não faz a pessoa sumir da árvore', () => {
    // Acontece quando o gestor saiu da empresa, ou está fora do filtro de
    // leitura. Perder o subordinado seria pior que mostrá-lo como raiz.
    const { raizes, orfaos } = montarArvore([p('a', 'chefe-que-nao-existe')]);

    expect(orfaos).toBe(1);
    expect(raizes.map((no) => no.externalId)).toEqual(['a']);
  });

  it('ciclo direto não trava a montagem', () => {
    // A reporta a B, B reporta a A. Diretório corporativo tem isso com
    // frequência incômoda, e a recursão ingênua entraria em laço infinito.
    const { raizes, ciclos } = montarArvore([p('a', 'b'), p('b', 'a')]);

    expect(ciclos).toBeGreaterThan(0);
    expect(raizes.length).toBeGreaterThan(0);
  });

  it('ciclo longo também é cortado', () => {
    const { raizes, ciclos } = montarArvore([p('a', 'c'), p('b', 'a'), p('c', 'b')]);

    expect(ciclos).toBeGreaterThan(0);
    // Todo mundo continua presente em algum lugar da floresta.
    const todos = new Set<string>();
    function coletar(no: { externalId: string; subordinados: Array<{ externalId: string; subordinados: unknown[] }> }) {
      todos.add(no.externalId);
      no.subordinados.forEach((filho) => coletar(filho as never));
    }
    raizes.forEach(coletar);
    expect([...todos].sort()).toEqual(['a', 'b', 'c']);
  });

  it('pessoa que é o próprio gestor vira raiz em vez de laço', () => {
    const { raizes, ciclos } = montarArvore([p('a', 'a')]);

    expect(ciclos).toBe(1);
    expect(raizes[0].externalId).toBe('a');
    expect(raizes[0].subordinados).toEqual([]);
  });

  it('marca quem já está vinculada a colaborador', () => {
    const { raizes } = montarArvore([p('a', null, { colaboradorId: 42 }), p('b')]);

    expect(raizes.find((no) => no.externalId === 'a')!.vinculada).toBe(true);
    expect(raizes.find((no) => no.externalId === 'b')!.vinculada).toBe(false);
  });

  it('lista vazia não quebra', () => {
    expect(montarArvore([])).toEqual({ raizes: [], semGestor: 0, orfaos: 0, ciclos: 0 });
  });
});

describe('sugestão de responsável por equipe', () => {
  const USUARIO = { activeTenantId: 7 } as never;
  const mockConexao = vi.mocked(directoryRepository.buscarConexao);
  const mockArvore = vi.mocked(directoryRepository.arvoreDeGestores);
  const mockEquipes = vi.mocked(directoryRepository.equipesDosVinculados);

  beforeEach(() => {
    vi.resetAllMocks();
    mockConexao.mockResolvedValue({ id: 3 } as never);
  });

  it('elege quem é gestor de mais gente da equipe', async () => {
    mockArvore.mockResolvedValue([
      p('lider', null, { colaboradorId: 90 }),
      p('outro', null, { colaboradorId: 91 }),
      p('a', 'lider', { colaboradorId: 1 }),
      p('b', 'lider', { colaboradorId: 2 }),
      p('c', 'outro', { colaboradorId: 3 }),
    ]);
    mockEquipes.mockResolvedValue([
      { colaboradorId: 1, equipeId: 10, equipeNome: 'NOC' },
      { colaboradorId: 2, equipeId: 10, equipeNome: 'NOC' },
      { colaboradorId: 3, equipeId: 10, equipeNome: 'NOC' },
    ]);

    const [sugestao] = await sugestoesDeResponsavel(3, USUARIO);

    expect(sugestao.equipe).toEqual({ id: 10, nome: 'NOC' });
    expect(sugestao.gestor.externalId).toBe('lider');
    expect(sugestao.pessoasQueReportam).toBe(2);
  });

  it('equipe sem ninguém vinculado não gera sugestão', async () => {
    // Sem vínculo não há como saber a quem a equipe reporta, e inventar um
    // responsável é pior que não sugerir nenhum.
    mockArvore.mockResolvedValue([p('a', 'lider')]);
    mockEquipes.mockResolvedValue([]);

    expect(await sugestoesDeResponsavel(3, USUARIO)).toEqual([]);
  });

  it('gestor que não está no espelho é ignorado', async () => {
    mockArvore.mockResolvedValue([p('a', 'chefe-que-saiu', { colaboradorId: 1 })]);
    mockEquipes.mockResolvedValue([{ colaboradorId: 1, equipeId: 10, equipeNome: 'NOC' }]);

    // Não dá para sugerir alguém de quem só se conhece o Object ID.
    expect(await sugestoesDeResponsavel(3, USUARIO)).toEqual([]);
  });

  it('gestor sem colaborador vinculado vira sugestão não acionável', async () => {
    // Responsável por equipe é um USUÁRIO do sistema. Sem vínculo não há como
    // chegar até ele — a sugestão aparece, marcada, mas não pode ser aplicada.
    mockArvore.mockResolvedValue([p('lider'), p('a', 'lider', { colaboradorId: 1 })]);
    mockEquipes.mockResolvedValue([{ colaboradorId: 1, equipeId: 10, equipeNome: 'NOC' }]);

    const [sugestao] = await sugestoesDeResponsavel(3, USUARIO);

    expect(sugestao.gestor.externalId).toBe('lider');
    expect(sugestao.gestor.colaboradorId).toBeNull();
  });

  it('ordena pelas equipes com mais gente reportando ao mesmo gestor', async () => {
    mockArvore.mockResolvedValue([
      p('l1', null, { colaboradorId: 90 }),
      p('l2', null, { colaboradorId: 91 }),
      p('a', 'l1', { colaboradorId: 1 }),
      p('b', 'l1', { colaboradorId: 2 }),
      p('c', 'l2', { colaboradorId: 3 }),
    ]);
    mockEquipes.mockResolvedValue([
      { colaboradorId: 3, equipeId: 20, equipeNome: 'Campo' },
      { colaboradorId: 1, equipeId: 10, equipeNome: 'NOC' },
      { colaboradorId: 2, equipeId: 10, equipeNome: 'NOC' },
    ]);

    const sugestoes = await sugestoesDeResponsavel(3, USUARIO);

    expect(sugestoes.map((sugestao) => sugestao.equipe.nome)).toEqual(['NOC', 'Campo']);
  });
});
