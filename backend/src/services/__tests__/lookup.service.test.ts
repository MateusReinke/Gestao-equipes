import { describe, expect, it } from 'vitest';
import { isValidCnpj, onlyDigits } from '../lookup.service';

describe('onlyDigits', () => {
  it('remove máscara de CNPJ', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('remove máscara de CEP', () => {
    expect(onlyDigits('01310-100')).toBe('01310100');
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ válido com máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('aceita CNPJ válido sem máscara', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
  });

  it('rejeita quantidade errada de dígitos', () => {
    expect(isValidCnpj('112223330001')).toBe(false);
    expect(isValidCnpj('112223330001812')).toBe(false);
  });

  it('rejeita sequências repetidas, que passam no cálculo mas não são CNPJs reais', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejeita string vazia ou não numérica', () => {
    expect(isValidCnpj('')).toBe(false);
    expect(isValidCnpj('abcdefghijklmn')).toBe(false);
  });
});

/* ------------------------------------------------ consulta com fetch simulado */

import { afterEach, beforeEach, vi } from 'vitest';
import { lookupCnpj, lookupCep, LookupNotFoundError, LookupUnavailableError, InvalidDocumentError } from '../lookup.service';

const CNPJ = '11222333000181';

/// Resposta HTTP mínima com o que o serviço consome.
function resposta(status: number, body: unknown) {
  const corpo = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => corpo };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lookupCnpj', () => {
  const respostaCompleta = {
    razao_social: 'ACME INDUSTRIA LTDA',
    nome_fantasia: 'Acme',
    descricao_situacao_cadastral: 'ATIVA',
    ddd_telefone_1: '1133334444',
    logradouro: 'AV PAULISTA',
    bairro: 'BELA VISTA',
    municipio: 'SAO PAULO',
    uf: 'SP',
  };

  it('nem chega à rede com CNPJ inválido', async () => {
    await expect(lookupCnpj('11222333000182')).rejects.toBeInstanceOf(InvalidDocumentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aceita cep e numero devolvidos como número, não só como string', async () => {
    // Era exatamente isto que quebrava: a API alterna entre os dois tipos e a
    // versão anterior descartava o valor numérico, deixando o campo vazio.
    fetchMock.mockResolvedValueOnce(resposta(200, { ...respostaCompleta, cep: 1310100, numero: 1578 }));

    const resultado = await lookupCnpj(CNPJ);

    expect(resultado.cep).toBe('1310100');
    expect(resultado.numero).toBe('1578');
  });

  it('aceita cep como string com máscara', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ...respostaCompleta, cep: '01310-100' }));
    expect((await lookupCnpj(CNPJ)).cep).toBe('01310100');
  });

  it('devolve o telefone só com dígitos', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ...respostaCompleta, ddd_telefone_1: '(11) 3333-4444' }));
    expect((await lookupCnpj(CNPJ)).telefone).toBe('1133334444');
  });

  it('ignora telefone curto demais para ser válido', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ...respostaCompleta, ddd_telefone_1: '1133' }));
    expect((await lookupCnpj(CNPJ)).telefone).toBeNull();
  });

  it('informa qual fonte respondeu', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, respostaCompleta));
    expect((await lookupCnpj(CNPJ)).fonte).toBe('BrasilAPI');
  });

  it('cai para a segunda fonte quando a primeira estoura o tempo', async () => {
    const abort = new Error('abortado');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abort);
    fetchMock.mockResolvedValueOnce(resposta(200, respostaCompleta));

    const resultado = await lookupCnpj(CNPJ);

    expect(resultado.fonte).toBe('Minha Receita');
    expect(resultado.razaoSocial).toBe('ACME INDUSTRIA LTDA');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cai para a segunda fonte quando a primeira limita as consultas (429)', async () => {
    fetchMock.mockResolvedValueOnce(resposta(429, {}));
    fetchMock.mockResolvedValueOnce(resposta(200, respostaCompleta));

    expect((await lookupCnpj(CNPJ)).fonte).toBe('Minha Receita');
  });

  it('cai para a segunda fonte quando a primeira responde 200 sem dados', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, {}));
    fetchMock.mockResolvedValueOnce(resposta(200, respostaCompleta));

    expect((await lookupCnpj(CNPJ)).fonte).toBe('Minha Receita');
  });

  it('404 é definitivo: não gasta a segunda fonte', async () => {
    fetchMock.mockResolvedValueOnce(resposta(404, {}));

    await expect(lookupCnpj(CNPJ)).rejects.toBeInstanceOf(LookupNotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('com todas as fontes fora, o erro diz o motivo de cada uma', async () => {
    fetchMock.mockResolvedValueOnce(resposta(429, {}));
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(lookupCnpj(CNPJ)).rejects.toThrowError(/limite de consultas.*falha de rede/s);
  });
});

describe('lookupCep', () => {
  it('recusa CEP com tamanho errado sem chamar a rede', async () => {
    await expect(lookupCep('123')).rejects.toBeInstanceOf(InvalidDocumentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa a BrasilAPI quando ela responde', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { street: 'Av Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' })
    );

    const resultado = await lookupCep('01310-100');

    expect(resultado).toMatchObject({ cep: '01310100', logradouro: 'Av Paulista', uf: 'SP', fonte: 'BrasilAPI' });
  });

  it('cai para o ViaCEP quando a BrasilAPI falha', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede'));
    fetchMock.mockResolvedValueOnce(
      resposta(200, { logradouro: 'Av Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' })
    );

    expect((await lookupCep('01310100')).fonte).toBe('ViaCEP');
  });

  it('trata o 200 com { erro: true } do ViaCEP como não encontrado', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede'));
    fetchMock.mockResolvedValueOnce(resposta(200, { erro: true }));

    await expect(lookupCep('99999999')).rejects.toBeInstanceOf(LookupNotFoundError);
  });

  it('404 da BrasilAPI é definitivo', async () => {
    fetchMock.mockResolvedValueOnce(resposta(404, {}));

    await expect(lookupCep('99999999')).rejects.toBeInstanceOf(LookupNotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('com as duas fontes fora, avisa para preencher manualmente', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede'));
    fetchMock.mockRejectedValueOnce(new Error('rede'));

    await expect(lookupCep('01310100')).rejects.toBeInstanceOf(LookupUnavailableError);
  });
});


/* -------------------------------------------- payload real da BrasilAPI */

/// Recorte fiel de uma resposta de produção — o que a Receita realmente
/// devolve, incluindo o logradouro partido em tipo + nome e o nome fantasia
/// vazio de empresa que não usa nome comercial.
const PAYLOAD_REAL = {
  uf: 'SP',
  cep: '04709001',
  cnpj: '61112886000150',
  email: null,
  bairro: 'SANTO AMARO',
  numero: '888',
  municipio: 'SAO PAULO',
  logradouro: 'BELA VISTA',
  complemento: '',
  razao_social: 'MAV EMPLACAMENTO LTDA',
  nome_fantasia: '',
  ddd_telefone_1: '1145479706',
  ddd_telefone_2: '',
  descricao_situacao_cadastral: 'ATIVA',
  descricao_tipo_de_logradouro: 'RUA',
};

describe('resposta real da BrasilAPI', () => {
  it('mapeia todos os campos que o formulário preenche', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, PAYLOAD_REAL));

    const resultado = await lookupCnpj('61112886000150');

    expect(resultado).toEqual({
      cnpj: '61112886000150',
      razaoSocial: 'MAV EMPLACAMENTO LTDA',
      // Nome fantasia vazio vira null, e o formulário cai para a razão social.
      nomeFantasia: null,
      situacao: 'ATIVA',
      telefone: '1145479706',
      email: null,
      cep: '04709001',
      // O tipo do logradouro é um campo à parte: sem juntar, gravaria só "BELA VISTA".
      logradouro: 'RUA BELA VISTA',
      numero: '888',
      complemento: null,
      bairro: 'SANTO AMARO',
      cidade: 'SAO PAULO',
      uf: 'SP',
      fonte: 'BrasilAPI',
    });
  });

  it('não duplica o tipo quando ele já vem no nome do logradouro', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { ...PAYLOAD_REAL, logradouro: 'RUA BELA VISTA', descricao_tipo_de_logradouro: 'RUA' })
    );

    expect((await lookupCnpj('61112886000150')).logradouro).toBe('RUA BELA VISTA');
  });

  it('sem o tipo, usa o nome do logradouro como está', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ...PAYLOAD_REAL, descricao_tipo_de_logradouro: '' }));

    expect((await lookupCnpj('61112886000150')).logradouro).toBe('BELA VISTA');
  });

  it('envia User-Agent — sem ele a borda da BrasilAPI trata como tráfego anônimo', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, PAYLOAD_REAL));

    await lookupCnpj('61112886000150');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/GestaoOperacional/);
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('resposta que não é JSON (página de bloqueio) não derruba: cai para a outra fonte', async () => {
    fetchMock.mockResolvedValueOnce(resposta(403, '<html>Forbidden</html>'));
    fetchMock.mockResolvedValueOnce(resposta(200, PAYLOAD_REAL));

    const resultado = await lookupCnpj('61112886000150');

    expect(resultado.fonte).toBe('Minha Receita');
    expect(resultado.razaoSocial).toBe('MAV EMPLACAMENTO LTDA');
  });
});

/* --------------------------------------------------------------- CPF */

import { isValidCpf, formatCpf } from '../../utils/cpf';

describe('isValidCpf', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('52998224726')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247250')).toBe(false);
  });

  it('rejeita sequências repetidas, que passam no cálculo mas não são CPFs reais', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('trata o caso em que o resto do cálculo é 10 (dígito vira zero)', () => {
    expect(isValidCpf('12345678909')).toBe(true);
  });
});

describe('formatCpf', () => {
  it('aplica a máscara', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('devolve nulo para vazio e o valor cru quando não tem 11 dígitos', () => {
    expect(formatCpf(null)).toBeNull();
    expect(formatCpf('123')).toBe('123');
  });
});
