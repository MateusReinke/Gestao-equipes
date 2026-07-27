import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PacoteCifradoInvalidoError,
  cifrar,
  contextoDaConexao,
  decifrar,
  impressaoDigital,
  limparCacheDeChave,
  temChaveDeCifragem,
} from '../crypto';

const SEGREDO = 'Abc8Q~exemplo-de-client-secret-do-entra';
const CONTEXTO = contextoDaConexao(7);

beforeEach(() => limparCacheDeChave());

describe('cifragem do segredo de conexão', () => {
  it('decifra de volta o que cifrou', () => {
    expect(decifrar(cifrar(SEGREDO, CONTEXTO), CONTEXTO)).toBe(SEGREDO);
  });

  it('produz pacotes diferentes para o mesmo texto', () => {
    // IV aleatório por gravação: dois segredos iguais no banco não devem
    // parecer iguais para quem olha as linhas.
    expect(cifrar(SEGREDO, CONTEXTO)).not.toBe(cifrar(SEGREDO, CONTEXTO));
  });

  it('preserva acento e caractere especial', () => {
    const texto = 'ção~!@#$%^&*()_+-={}[]|:;"<>,.?/€ção';
    expect(decifrar(cifrar(texto, CONTEXTO), CONTEXTO)).toBe(texto);
  });

  it('recusa decifrar com o contexto de outra empresa', () => {
    // É o que impede copiar a linha de credencial de um tenant para outro.
    const pacote = cifrar(SEGREDO, contextoDaConexao(7));
    expect(() => decifrar(pacote, contextoDaConexao(9))).toThrow(PacoteCifradoInvalidoError);
  });

  it('recusa pacote com o texto cifrado adulterado', () => {
    const pacote = cifrar(SEGREDO, CONTEXTO);
    const partes = pacote.split('.');
    const corrompido = Buffer.from(partes[3], 'base64');
    corrompido[0] ^= 0xff;
    partes[3] = corrompido.toString('base64');

    expect(() => decifrar(partes.join('.'), CONTEXTO)).toThrow(PacoteCifradoInvalidoError);
  });

  it('recusa pacote com a tag de autenticação adulterada', () => {
    const pacote = cifrar(SEGREDO, CONTEXTO);
    const partes = pacote.split('.');
    const tag = Buffer.from(partes[2], 'base64');
    tag[0] ^= 0xff;
    partes[2] = tag.toString('base64');

    expect(() => decifrar(partes.join('.'), CONTEXTO)).toThrow(PacoteCifradoInvalidoError);
  });

  it('recusa formato desconhecido e versão futura', () => {
    expect(() => decifrar('nao-e-um-pacote', CONTEXTO)).toThrow(PacoteCifradoInvalidoError);
    expect(() => decifrar('v2.aaa.bbb.ccc', CONTEXTO)).toThrow(PacoteCifradoInvalidoError);
  });

  it('a mensagem de falha aponta para a troca de chave, que é a causa real', () => {
    expect(() => decifrar('v1.aaa.bbb.ccc', CONTEXTO)).toThrow(/DIRECTORY_ENCRYPTION_KEY/);
  });
});

describe('impressão digital', () => {
  it('é estável, curta e não revela o segredo', () => {
    const impressao = impressaoDigital(SEGREDO);

    expect(impressao).toHaveLength(8);
    expect(impressao).toBe(impressaoDigital(SEGREDO));
    expect(SEGREDO).not.toContain(impressao);
  });

  it('muda quando o segredo muda', () => {
    expect(impressaoDigital(SEGREDO)).not.toBe(impressaoDigital(`${SEGREDO}x`));
  });
});

/// Cada forma de chave precisa de um módulo recarregado, porque `env` é
/// montado na importação.
async function comChave(valor: string | undefined) {
  vi.resetModules();
  vi.doMock('../../../config/env', () => ({
    env: { directoryEncryptionKey: valor ?? '' },
    directoryDefaults: {},
  }));
  return import('../crypto');
}

describe('formas aceitas de DIRECTORY_ENCRYPTION_KEY', () => {
  it('aceita 32 bytes em hex', async () => {
    const cripto = await comChave('a'.repeat(64));
    const ctx = cripto.contextoDaConexao(1);
    expect(cripto.decifrar(cripto.cifrar('x', ctx), ctx)).toBe('x');
  });

  it('aceita 32 bytes em base64', async () => {
    const cripto = await comChave('t6mv4evs/ocQxzm7hHq2gEW2GvRnX5zv44KDEY0rfms=');
    const ctx = cripto.contextoDaConexao(1);
    expect(cripto.decifrar(cripto.cifrar('x', ctx), ctx)).toBe('x');
  });

  it('deriva de frase longa e a derivação é determinística', async () => {
    const frase = 'uma frase suficientemente longa para servir de chave mestra';

    const primeiro = await comChave(frase);
    const pacote = primeiro.cifrar('x', primeiro.contextoDaConexao(1));

    // Outro boot do processo, mesma frase: precisa abrir o que foi gravado
    // antes — senão toda reinicialização invalidaria as credenciais salvas.
    const segundo = await comChave(frase);
    expect(segundo.decifrar(pacote, segundo.contextoDaConexao(1))).toBe('x');
  });

  it('recusa frase curta demais', async () => {
    const cripto = await comChave('curta');
    expect(() => cripto.cifrar('x', 'ctx')).toThrow(cripto.ChaveDeCifragemAusenteError);
  });

  it('sem chave nenhuma, explica o que fazer', async () => {
    const cripto = await comChave(undefined);
    expect(() => cripto.cifrar('x', 'ctx')).toThrow(/openssl rand -base64 32/);
  });
});

describe('temChaveDeCifragem', () => {
  it('responde sem lançar', () => {
    expect(temChaveDeCifragem()).toBe(true);
  });
});
