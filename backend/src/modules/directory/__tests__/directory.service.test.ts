import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../directory.repository', () => ({
  directoryRepository: {
    listarConexoes: vi.fn(),
    buscarConexao: vi.fn(),
    buscarConexaoPorProvedor: vi.fn(),
    criarConexao: vi.fn(),
    atualizarConexao: vi.fn(),
    registrarTeste: vi.fn(),
    contarVinculos: vi.fn(),
    removerConexao: vi.fn(),
    equipeExiste: vi.fn(),
  },
}));

vi.mock('../providers', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../providers')>();
  return { ...original, criarProvider: vi.fn() };
});

import { directoryRepository } from '../directory.repository';
import { criarProvider } from '../providers';
import { cifrar, contextoDaConexao } from '../crypto';
import { FakeProvider } from '../providers/fake.provider';
import {
  ConexaoComVinculosError,
  ConexaoDuplicadaError,
  ConexaoNaoEncontradaError,
  EquipePadraoInvalidaError,
  SegredoObrigatorioError,
  SemEmpresaAtivaError,
  apresentarConexao,
  atualizarConexao,
  conexaoSchema,
  criarConexao,
  removerConexao,
  testarConexao,
} from '../directory.service';

const admin = { sub: 'admin@empresa.com', userId: 1, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'admin_tenant' };
const GUID_A = '11111111-1111-1111-1111-111111111111';
const GUID_B = '22222222-2222-2222-2222-222222222222';
const SEGREDO = 'Abc8Q~segredo-de-verdade';

const OPCOES_PADRAO = {
  sincronizarUsuarios: true,
  sincronizarDepartamentos: true,
  sincronizarCargos: true,
  sincronizarGestores: true,
  sincronizarFotos: false,
  sincronizarGrupos: false,
  sincronizarUsuariosDesabilitados: true,
  autoCriarColaboradores: false,
  autoDesativarColaboradores: false,
  logOperacoes: true,
  sincronizacaoCompletaNaPrimeira: true,
  intervaloMinutos: 60,
  paisPadrao: 'BR',
  fusoHorarioPadrao: 'America/Sao_Paulo',
  idiomaPadrao: 'pt-BR',
};

function conexaoSalva(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: 3,
    tenantId: 7,
    provider: 'entra' as const,
    nome: 'Microsoft Entra ID',
    ativo: true,
    provedorTenantId: GUID_A,
    clientId: GUID_B,
    clientSecretCifrado: cifrar(SEGREDO, contextoDaConexao(7)),
    authorityUrl: null,
    opcoes: OPCOES_PADRAO,
    equipePadraoId: null,
    equipePadrao: null,
    cursorPessoas: null,
    cursorGrupos: null,
    ultimaSincronizacaoEm: null,
    sincronizandoDesde: null,
    ultimoTesteEm: new Date('2026-07-01T10:00:00Z'),
    ultimoTesteOk: true,
    ultimoErro: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...sobrescreve,
  };
}

const mockBuscar = vi.mocked(directoryRepository.buscarConexao);
const mockPorProvedor = vi.mocked(directoryRepository.buscarConexaoPorProvedor);
const mockCriar = vi.mocked(directoryRepository.criarConexao);
const mockAtualizar = vi.mocked(directoryRepository.atualizarConexao);
const mockEquipe = vi.mocked(directoryRepository.equipeExiste);
const mockVinculos = vi.mocked(directoryRepository.contarVinculos);
const mockRegistrarTeste = vi.mocked(directoryRepository.registrarTeste);
const mockProvider = vi.mocked(criarProvider);

const TESTE_OK = { ok: true, organizacao: null, verificacoes: [], erro: null };

beforeEach(() => {
  vi.resetAllMocks();
  mockProvider.mockReturnValue(new FakeProvider({ paginas: [], resultadoDoTeste: TESTE_OK }));
});

describe('validação do formulário', () => {
  const base = { nome: 'Entra', provedorTenantId: GUID_A, clientId: GUID_B, clientSecret: SEGREDO };

  it('aceita um cadastro completo', () => {
    expect(conexaoSchema.safeParse(base).success).toBe(true);
  });

  it('rejeita domínio no lugar do Directory ID, que é o engano mais comum', () => {
    const resultado = conexaoSchema.safeParse({ ...base, provedorTenantId: 'contoso.onmicrosoft.com' });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.flatten().fieldErrors.provedorTenantId?.[0]).toMatch(/GUID/);
  });

  it('rejeita segredo vazio', () => {
    expect(conexaoSchema.safeParse({ ...base, clientSecret: '' }).success).toBe(false);
  });

  it('nasce inativa e sem criação automática de colaborador', () => {
    const dados = conexaoSchema.parse(base);
    expect(dados.ativo).toBe(false);
  });
});

describe('apresentação da conexão', () => {
  it('nunca devolve o segredo, só a impressão digital', () => {
    const publico = apresentarConexao(conexaoSalva());
    const serializado = JSON.stringify(publico);

    expect(serializado).not.toContain(SEGREDO);
    expect(serializado).not.toContain('clientSecret');
    expect(publico.segredoImpressao).toHaveLength(8);
    expect(publico.segredoIlegivel).toBe(false);
  });

  it('sinaliza segredo ilegível quando a chave do ambiente mudou', () => {
    // Pacote cifrado para outra empresa: a chave é a mesma, o contexto não.
    // É indistinguível, do ponto de vista da tela, de uma troca de chave.
    const publico = apresentarConexao(conexaoSalva({ clientSecretCifrado: cifrar(SEGREDO, contextoDaConexao(99)) }));

    expect(publico.segredoIlegivel).toBe(true);
    expect(publico.segredoImpressao).toBeNull();
  });

  it('completa flags ausentes com o padrão do ambiente', () => {
    const publico = apresentarConexao(conexaoSalva({ opcoes: { sincronizarFotos: true } }));

    expect(publico.opcoes.sincronizarFotos).toBe(true);
    expect(publico.opcoes.sincronizarUsuarios).toBe(true);
    expect(publico.opcoes.intervaloMinutos).toBe(60);
  });
});

describe('criação', () => {
  const entrada = {
    provider: 'entra' as const,
    nome: 'Entra',
    ativo: false,
    provedorTenantId: GUID_A,
    clientId: GUID_B,
    clientSecret: SEGREDO,
  };

  it('exige empresa ativa', async () => {
    await expect(criarConexao(entrada, { ...admin, activeTenantId: null })).rejects.toBeInstanceOf(SemEmpresaAtivaError);
  });

  it('recusa uma segunda conexão com o mesmo provedor', async () => {
    mockPorProvedor.mockResolvedValue(conexaoSalva() as never);
    await expect(criarConexao(entrada, admin)).rejects.toBeInstanceOf(ConexaoDuplicadaError);
  });

  it('grava o segredo cifrado, nunca em claro', async () => {
    mockPorProvedor.mockResolvedValue(null);
    mockCriar.mockResolvedValue(conexaoSalva() as never);

    await criarConexao(entrada, admin);

    const gravado = mockCriar.mock.calls[0][1] as { clientSecretCifrado: string };
    expect(gravado.clientSecretCifrado).not.toContain(SEGREDO);
    expect(gravado.clientSecretCifrado).toMatch(/^v1\./);
  });

  it('barra criação automática sem equipe de entrada', async () => {
    mockPorProvedor.mockResolvedValue(null);

    // `colaboradores.equipe_id` é NOT NULL: sem equipe não há como criar.
    await expect(
      criarConexao({ ...entrada, opcoes: { autoCriarColaboradores: true } }, admin)
    ).rejects.toBeInstanceOf(EquipePadraoInvalidaError);
  });

  it('recusa equipe de entrada de outra empresa', async () => {
    mockPorProvedor.mockResolvedValue(null);
    mockEquipe.mockResolvedValue(null);

    await expect(criarConexao({ ...entrada, equipePadraoId: 99 }, admin)).rejects.toThrow(/não existe nesta empresa/);
  });
});

describe('edição', () => {
  it('mantém o segredo guardado quando nenhum novo é enviado', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockAtualizar.mockResolvedValue(conexaoSalva() as never);

    await atualizarConexao(3, { nome: 'Outro nome' }, admin);

    expect(mockAtualizar.mock.calls[0][2]).not.toHaveProperty('clientSecretCifrado');
  });

  it('substitui o segredo quando um novo é enviado', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockAtualizar.mockResolvedValue(conexaoSalva() as never);

    await atualizarConexao(3, { clientSecret: 'novo-segredo-longo' }, admin);

    expect(mockAtualizar.mock.calls[0][2]).toHaveProperty('clientSecretCifrado');
  });

  it('trocar credencial invalida o resultado do último teste', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockAtualizar.mockResolvedValue(conexaoSalva() as never);

    await atualizarConexao(3, { clientId: '33333333-3333-3333-3333-333333333333' }, admin);

    // O "verde" de antes não diz nada sobre a configuração de agora.
    const mudancas = mockAtualizar.mock.calls[0][2];
    expect(mudancas.ultimoTesteEm).toBeNull();
    expect(mudancas.ultimoTesteOk).toBeNull();
  });

  it('mudar só uma flag preserva o resultado do teste', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockAtualizar.mockResolvedValue(conexaoSalva() as never);

    await atualizarConexao(3, { opcoes: { sincronizarFotos: true } }, admin);

    expect(mockAtualizar.mock.calls[0][2]).not.toHaveProperty('ultimoTesteEm');
  });

  it('mescla as flags em vez de substituir o conjunto', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva({ opcoes: { ...OPCOES_PADRAO, sincronizarGrupos: true } }) as never);
    mockAtualizar.mockResolvedValue(conexaoSalva() as never);

    await atualizarConexao(3, { opcoes: { sincronizarFotos: true } }, admin);

    const opcoes = mockAtualizar.mock.calls[0][2].opcoes as Record<string, unknown>;
    expect(opcoes.sincronizarFotos).toBe(true);
    expect(opcoes.sincronizarGrupos).toBe(true);
  });

  it('404 quando a conexão é de outra empresa', async () => {
    mockBuscar.mockResolvedValue(null);
    await expect(atualizarConexao(3, { nome: 'x' }, admin)).rejects.toBeInstanceOf(ConexaoNaoEncontradaError);
  });
});

describe('remoção', () => {
  it('segura a remoção quando há pessoa vinculada a colaborador', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockVinculos.mockResolvedValue([120, 8] as never);

    const erro = await removerConexao(3, admin).catch((e) => e);

    expect(erro).toBeInstanceOf(ConexaoComVinculosError);
    expect(erro.detalhes).toEqual({ pessoas: 120, vinculos: 8 });
    // A mensagem precisa oferecer a saída, não só recusar.
    expect(erro.message).toMatch(/desative a conexão/i);
  });

  it('remove quando o espelho não foi reconciliado com ninguém', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockVinculos.mockResolvedValue([120, 0] as never);

    await removerConexao(3, admin);

    expect(directoryRepository.removerConexao).toHaveBeenCalledWith(7, 3);
  });
});

describe('teste de conexão', () => {
  it('rascunho sem segredo não vai ao provedor', async () => {
    await expect(testarConexao(null, undefined, { provedorTenantId: GUID_A, clientId: GUID_B }, admin)).rejects.toBeInstanceOf(
      SegredoObrigatorioError
    );
  });

  it('rascunho testa sem gravar nada', async () => {
    await testarConexao(null, SEGREDO, { provedorTenantId: GUID_A, clientId: GUID_B }, admin);

    expect(mockRegistrarTeste).not.toHaveBeenCalled();
  });

  it('conexão salva reaproveita o segredo guardado', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);

    await testarConexao(3, undefined, undefined, admin);

    // Decifrou e passou adiante — sem obrigar quem edita a redigitar.
    expect(mockProvider.mock.calls[0][1].clientSecret).toBe(SEGREDO);
  });

  it('conexão salva registra o resultado', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);

    await testarConexao(3, undefined, undefined, admin);

    expect(mockRegistrarTeste).toHaveBeenCalledWith(7, 3, true, null);
  });

  it('registra a falha obrigatória como motivo do erro', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);
    mockProvider.mockReturnValue(
      new FakeProvider({
        paginas: [],
        resultadoDoTeste: {
        ok: false,
        organizacao: null,
        erro: null,
        verificacoes: [
          { recurso: 'Grupos', permissao: 'Group.Read.All', ok: false, obrigatoria: false, detalhe: 'opcional falhou' },
            { recurso: 'Usuários', permissao: 'User.Read.All', ok: false, obrigatoria: true, detalhe: 'falta consentimento' },
          ],
        },
      })
    );

    await testarConexao(3, undefined, undefined, admin);

    // O que se registra é a obrigatória, não a primeira da lista.
    expect(mockRegistrarTeste).toHaveBeenCalledWith(7, 3, false, 'falta consentimento');
  });

  it('o formulário em edição prevalece sobre o que está salvo', async () => {
    mockBuscar.mockResolvedValue(conexaoSalva() as never);

    await testarConexao(3, undefined, { clientId: '44444444-4444-4444-4444-444444444444' }, admin);

    expect(mockProvider.mock.calls[0][1].clientId).toBe('44444444-4444-4444-4444-444444444444');
  });
});
