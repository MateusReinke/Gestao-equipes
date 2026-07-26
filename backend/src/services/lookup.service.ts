/**
 * Consultas a APIs públicas gratuitas para preencher cadastro automaticamente.
 * - CNPJ: BrasilAPI (https://brasilapi.com.br) — dados da Receita Federal.
 * - CEP:  BrasilAPI com fallback para ViaCEP.
 *
 * Ficam no backend (e não no navegador) para não expor o usuário a CORS,
 * padronizar o formato de resposta e permitir rate limit/observabilidade depois.
 */

const TIMEOUT_MS = 8000;

export class InvalidDocumentError extends Error {}
export class LookupNotFoundError extends Error {}
export class LookupUnavailableError extends Error {}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/// Validação real dos dígitos verificadores — evita gastar chamada de API com CNPJ inválido.
export function isValidCnpj(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, char, index) => acc + Number(char) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiro = calcDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(digits[12]) && segundo === Number(digits[13]);
}

export type CnpjLookupResult = {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export async function lookupCnpj(cnpjBruto: string): Promise<CnpjLookupResult> {
  const cnpj = onlyDigits(cnpjBruto);
  if (!isValidCnpj(cnpj)) throw new InvalidDocumentError('CNPJ inválido');

  let resultado: { ok: boolean; status: number; data: Record<string, unknown> };
  try {
    resultado = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  } catch {
    throw new LookupUnavailableError('Não foi possível consultar o CNPJ agora. Preencha manualmente e tente de novo depois.');
  }

  if (resultado.status === 404) throw new LookupNotFoundError('CNPJ não encontrado na base da Receita Federal');
  if (!resultado.ok) throw new LookupUnavailableError('Serviço de consulta de CNPJ indisponível no momento');

  const data = resultado.data;
  const str = (key: string) => {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  return {
    cnpj,
    razaoSocial: str('razao_social'),
    nomeFantasia: str('nome_fantasia'),
    situacao: str('descricao_situacao_cadastral'),
    telefone: str('ddd_telefone_1'),
    email: str('email'),
    cep: str('cep') ? onlyDigits(String(data.cep)) : null,
    logradouro: str('logradouro'),
    numero: str('numero'),
    complemento: str('complemento'),
    bairro: str('bairro'),
    cidade: str('municipio'),
    uf: str('uf'),
  };
}

export type CepLookupResult = {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export async function lookupCep(cepBruto: string): Promise<CepLookupResult> {
  const cep = onlyDigits(cepBruto);
  if (cep.length !== 8) throw new InvalidDocumentError('CEP deve ter 8 dígitos');

  // Tentativa 1: BrasilAPI (agrega várias fontes).
  try {
    const resultado = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (resultado.ok) {
      const data = resultado.data;
      return {
        cep,
        logradouro: (data.street as string) || null,
        bairro: (data.neighborhood as string) || null,
        cidade: (data.city as string) || null,
        uf: (data.state as string) || null,
      };
    }
    if (resultado.status === 404) throw new LookupNotFoundError('CEP não encontrado');
  } catch (error) {
    if (error instanceof LookupNotFoundError) throw error;
    // Cai para o ViaCEP abaixo.
  }

  // Tentativa 2: ViaCEP.
  try {
    const resultado = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (resultado.ok && !resultado.data.erro) {
      const data = resultado.data;
      return {
        cep,
        logradouro: (data.logradouro as string) || null,
        bairro: (data.bairro as string) || null,
        cidade: (data.localidade as string) || null,
        uf: (data.uf as string) || null,
      };
    }
    throw new LookupNotFoundError('CEP não encontrado');
  } catch (error) {
    if (error instanceof LookupNotFoundError) throw error;
    throw new LookupUnavailableError('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
  }
}
