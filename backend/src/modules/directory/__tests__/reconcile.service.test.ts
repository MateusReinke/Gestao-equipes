import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../repositories/collaborator.repository', () => ({
  collaboratorRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../directory.repository', () => ({
  directoryRepository: {
    pessoasVinculadas: vi.fn(),
    pessoasSemVinculo: vi.fn(),
    vincular: vi.fn(),
  },
}));

import { collaboratorRepository } from '../../../repositories/collaborator.repository';
import { directoryRepository } from '../directory.repository';
import {
  CAMPOS_TRAVAVEIS,
  NUNCA_TOCADOS,
  calcularMudancas,
  criarColaboradoresAutomaticamente,
  reconciliarVinculados,
  type PessoaParaReconciliar,
} from '../sync/reconcile.service';

const mockFindById = vi.mocked(collaboratorRepository.findById);
const mockFindByEmail = vi.mocked(collaboratorRepository.findByEmail);
const mockCreate = vi.mocked(collaboratorRepository.create);
const mockUpdate = vi.mocked(collaboratorRepository.update);
const mockVinculadas = vi.mocked(directoryRepository.pessoasVinculadas);
const mockSemVinculo = vi.mocked(directoryRepository.pessoasSemVinculo);
const mockVincular = vi.mocked(directoryRepository.vincular);

function pessoa(sobrescreve: Partial<PessoaParaReconciliar> = {}): PessoaParaReconciliar {
  return {
    id: 1,
    externalId: 'oid-1',
    nomeExibicao: 'Ana Lima',
    email: 'ana@contoso.com',
    cargo: 'Analista de NOC',
    telefone: '+55 11 4547-9706',
    celular: null,
    contaHabilitada: true,
    removidoEm: null,
    colaboradorId: 10,
    camposBloqueados: [],
    ...sobrescreve,
  };
}

function colaborador(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: 10,
    nome: 'Ana L.',
    email: 'ana.antiga@contoso.com',
    cargo: 'Analista',
    telefone: '',
    ativo: true,
    // Campos operacionais, presentes para provar que ninguém os toca.
    equipeId: 3,
    tipoContrato: 'clt',
    modeloTrabalho: 'presencial',
    fazPlantao: true,
    sobreAviso: true,
    dataAdmissao: new Date('2020-01-15'),
    dataDesligamento: null,
    matricula: 'M-001',
    cpf: '12345678909',
    ...sobrescreve,
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUpdate.mockResolvedValue({} as never);
  mockVincular.mockResolvedValue(1);
  mockVinculadas.mockResolvedValue([] as never);
  mockSemVinculo.mockResolvedValue([] as never);
});

describe('a lista fechada', () => {
  it('nunca produz mudança em campo operacional', () => {
    const mudancas = calcularMudancas(pessoa(), colaborador(), { autoDesativar: true });
    const tocados = mudancas.map((mudanca) => mudanca.campo);

    // A garantia central do módulo, verificada: nenhum campo que decide
    // escala, contrato ou cálculo de férias entra na lista de mudanças.
    for (const proibido of NUNCA_TOCADOS) {
      expect(tocados).not.toContain(proibido);
    }
  });

  it('dataDesligamento não é tocada nem quando a conta é desabilitada', () => {
    // O ponto mais delicado do módulo: gravá-la truncaria o período aquisitivo
    // e reduziria direito a férias em silêncio.
    const mudancas = calcularMudancas(pessoa({ contaHabilitada: false }), colaborador(), { autoDesativar: true });

    expect(mudancas.map((m) => m.campo)).toContain('ativo');
    expect(mudancas.map((m) => m.campo)).not.toContain('dataDesligamento');
  });

  it('só expõe como travável o que a sincronização de fato escreve', () => {
    // Travar um campo intocável daria falsa sensação de proteção.
    for (const campo of NUNCA_TOCADOS) {
      expect(CAMPOS_TRAVAVEIS).not.toContain(campo);
    }
    expect(CAMPOS_TRAVAVEIS).toEqual(expect.arrayContaining(['nome', 'email', 'cargo', 'telefone', 'ativo']));
  });
});

describe('precedência de campos', () => {
  it('o diretório manda em nome, e-mail e cargo', () => {
    const mudancas = calcularMudancas(pessoa(), colaborador(), { autoDesativar: false });

    expect(mudancas).toEqual(
      expect.arrayContaining([
        { campo: 'nome', de: 'Ana L.', para: 'Ana Lima' },
        { campo: 'email', de: 'ana.antiga@contoso.com', para: 'ana@contoso.com' },
        { campo: 'cargo', de: 'Analista', para: 'Analista de NOC' },
      ])
    );
  });

  it('nulo do diretório não apaga o que o cadastro tem', () => {
    // Ausência de informação não é informação de ausência.
    const mudancas = calcularMudancas(
      pessoa({ cargo: null, email: null }),
      colaborador(),
      { autoDesativar: false }
    );

    expect(mudancas.map((m) => m.campo)).not.toContain('cargo');
    expect(mudancas.map((m) => m.campo)).not.toContain('email');
  });

  it('valor igual não vira mudança', () => {
    const mudancas = calcularMudancas(
      pessoa({ nomeExibicao: 'Ana L.', email: 'ana.antiga@contoso.com', cargo: 'Analista' }),
      colaborador(),
      { autoDesativar: false }
    );
    expect(mudancas.filter((m) => m.campo !== 'telefone')).toEqual([]);
  });

  it('telefone só preenche quando o cadastro está vazio', () => {
    const vazio = calcularMudancas(pessoa(), colaborador({ telefone: '' }), { autoDesativar: false });
    expect(vazio).toContainEqual({ campo: 'telefone', de: '', para: '+55 11 4547-9706' });

    const preenchido = calcularMudancas(
      pessoa(),
      colaborador({ telefone: '+55 11 90000-0000' }),
      { autoDesativar: false }
    );
    // Sobrescrever um celular que o RH acabou de corrigir seria regressão.
    expect(preenchido.map((m) => m.campo)).not.toContain('telefone');
  });

  it('cai no celular quando não há telefone comercial', () => {
    const mudancas = calcularMudancas(
      pessoa({ telefone: null, celular: '+55 11 98888-7777' }),
      colaborador({ telefone: '' }),
      { autoDesativar: false }
    );
    expect(mudancas).toContainEqual({ campo: 'telefone', de: '', para: '+55 11 98888-7777' });
  });
});

describe('travas de campo', () => {
  it('campo travado não muda, mesmo divergindo do diretório', () => {
    const mudancas = calcularMudancas(
      pessoa({ camposBloqueados: ['cargo', 'nome'] }),
      colaborador(),
      { autoDesativar: false }
    );

    const campos = mudancas.map((m) => m.campo);
    expect(campos).not.toContain('cargo');
    expect(campos).not.toContain('nome');
    // Os não travados seguem normalmente.
    expect(campos).toContain('email');
  });

  it('travar `ativo` impede a auto-desativação', () => {
    // É a saída de quem desativou alguém por motivo operacional e não quer o
    // diretório reativando na próxima execução.
    const mudancas = calcularMudancas(
      pessoa({ contaHabilitada: false, camposBloqueados: ['ativo'] }),
      colaborador(),
      { autoDesativar: true }
    );
    expect(mudancas.map((m) => m.campo)).not.toContain('ativo');
  });
});

describe('ativo segue a conta do diretório', () => {
  it('conta desabilitada desativa o colaborador', () => {
    const mudancas = calcularMudancas(pessoa({ contaHabilitada: false }), colaborador({ ativo: true }), {
      autoDesativar: true,
    });
    expect(mudancas).toContainEqual({ campo: 'ativo', de: true, para: false });
  });

  it('pessoa que saiu do diretório desativa o colaborador', () => {
    const mudancas = calcularMudancas(pessoa({ removidoEm: new Date() }), colaborador({ ativo: true }), {
      autoDesativar: true,
    });
    expect(mudancas).toContainEqual({ campo: 'ativo', de: true, para: false });
  });

  it('conta reabilitada reativa o colaborador', () => {
    const mudancas = calcularMudancas(pessoa({ contaHabilitada: true }), colaborador({ ativo: false }), {
      autoDesativar: true,
    });
    expect(mudancas).toContainEqual({ campo: 'ativo', de: false, para: true });
  });

  it('com a opção desligada, `ativo` nunca é tocado', () => {
    const mudancas = calcularMudancas(pessoa({ contaHabilitada: false }), colaborador({ ativo: true }), {
      autoDesativar: false,
    });
    expect(mudancas.map((m) => m.campo)).not.toContain('ativo');
  });
});

describe('reconciliação dos vinculados', () => {
  it('grava só os campos que mudaram', async () => {
    mockVinculadas.mockResolvedValue([pessoa()] as never);
    mockFindById.mockResolvedValue(colaborador());

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: false });

    expect(resultado.atualizados).toBe(1);
    const gravado = mockUpdate.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(gravado).sort()).toEqual(['cargo', 'email', 'nome', 'telefone']);
  });

  it('não grava nada quando não há diferença', async () => {
    mockVinculadas.mockResolvedValue([
      pessoa({ nomeExibicao: 'Ana L.', email: 'ana.antiga@contoso.com', cargo: 'Analista', telefone: null, celular: null }),
    ] as never);
    mockFindById.mockResolvedValue(colaborador());

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: false });

    expect(resultado.atualizados).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('colisão de e-mail vira conflito, não gravação forçada', async () => {
    mockVinculadas.mockResolvedValue([pessoa()] as never);
    mockFindById.mockResolvedValue(colaborador());
    mockUpdate.mockRejectedValue(new Error('Unique constraint failed on (tenant_id, email)'));

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: false });

    expect(resultado.atualizados).toBe(0);
    expect(resultado.conflitos[0]).toMatchObject({ externalId: 'oid-1', nome: 'Ana Lima' });
    expect(resultado.conflitos[0].motivo).toMatch(/Unique constraint/);
  });

  it('uma pessoa com problema não interrompe as demais', async () => {
    mockVinculadas.mockResolvedValue([pessoa({ id: 1, externalId: 'oid-1' }), pessoa({ id: 2, externalId: 'oid-2', colaboradorId: 11 })] as never);
    mockFindById.mockResolvedValue(colaborador());
    mockUpdate.mockRejectedValueOnce(new Error('falhou'));

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: false });

    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.atualizados).toBe(1);
  });

  it('vínculo apontando para colaborador inexistente vira conflito visível', async () => {
    mockVinculadas.mockResolvedValue([pessoa()] as never);
    mockFindById.mockResolvedValue(null);

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: false });

    expect(resultado.conflitos[0].motivo).toMatch(/não existe mais/);
  });

  it('conta desativados e reativados em separado', async () => {
    mockVinculadas.mockResolvedValue([
      pessoa({ id: 1, externalId: 'a', contaHabilitada: false, nomeExibicao: 'Ana L.', email: 'ana.antiga@contoso.com', cargo: 'Analista', telefone: null }),
      pessoa({ id: 2, externalId: 'b', colaboradorId: 11, contaHabilitada: true, nomeExibicao: 'Ana L.', email: 'ana.antiga@contoso.com', cargo: 'Analista', telefone: null }),
    ] as never);
    mockFindById
      .mockResolvedValueOnce(colaborador({ ativo: true }))
      .mockResolvedValueOnce(colaborador({ id: 11, ativo: false }));

    const resultado = await reconciliarVinculados({ tenantId: 7, connectionId: 3, autoDesativar: true });

    expect(resultado.desativados).toBe(1);
    expect(resultado.reativados).toBe(1);
  });
});

describe('criação automática', () => {
  const semVinculo = pessoa({ colaboradorId: null, email: 'nova@contoso.com', nomeExibicao: 'Pessoa Nova' });

  it('cria e vincula quem não existe no cadastro', async () => {
    mockSemVinculo.mockResolvedValue([semVinculo] as never);
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 99 } as never);

    const resultado = await criarColaboradoresAutomaticamente({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });

    expect(resultado.criados).toBe(1);
    expect(mockVincular).toHaveBeenCalledWith(7, 1, 99);
  });

  it('o colaborador criado nasce sem plantão e sem data de admissão', async () => {
    mockSemVinculo.mockResolvedValue([semVinculo] as never);
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 99 } as never);

    await criarColaboradoresAutomaticamente({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });

    const criado = mockCreate.mock.calls[0][1] as Record<string, unknown>;
    // Entrar na escala de plantão por omissão seria pior que corrigir depois.
    expect(criado.fazPlantao).toBe(false);
    expect(criado.sobreAviso).toBe(false);
    expect(criado.equipeId).toBe(5);
    // O diretório não sabe quando a pessoa foi contratada, e chutar essa data
    // corromperia o cálculo de férias.
    expect(criado).not.toHaveProperty('dataAdmissao');
  });

  it('e-mail que já existe vira conflito, e NÃO vínculo automático', async () => {
    mockSemVinculo.mockResolvedValue([semVinculo] as never);
    mockFindByEmail.mockResolvedValue({ id: 42, nome: 'Outra Pessoa' } as never);

    const resultado = await criarColaboradoresAutomaticamente({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });

    // Ligar por e-mail automaticamente entregaria o histórico de alguém a
    // outra pessoa no dia em que um endereço fosse reciclado.
    expect(resultado.criados).toBe(0);
    expect(mockVincular).not.toHaveBeenCalled();
    expect(resultado.conflitos[0].motivo).toMatch(/Vincule manualmente/);
  });

  it('conta desabilitada não vira colaborador', async () => {
    mockSemVinculo.mockResolvedValue([pessoa({ colaboradorId: null, contaHabilitada: false })] as never);

    const resultado = await criarColaboradoresAutomaticamente({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });

    expect(resultado.criados).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('pessoa sem e-mail vira conflito explicando o motivo', async () => {
    mockSemVinculo.mockResolvedValue([pessoa({ colaboradorId: null, email: null })] as never);

    const resultado = await criarColaboradoresAutomaticamente({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });

    expect(resultado.conflitos[0].motivo).toMatch(/Sem e-mail/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
