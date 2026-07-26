/**
 * Consultas a APIs públicas gratuitas para preencher cadastro automaticamente.
 * - CNPJ: BrasilAPI com fallback para Minha Receita — ambas servem os dados
 *   abertos da Receita Federal, e nenhuma das duas tem disponibilidade boa o
 *   bastante para ser a única fonte.
 * - CEP:  BrasilAPI com fallback para ViaCEP.
 *
 * Ficam no backend (e não no navegador) para não expor o usuário a CORS,
 * padronizar o formato de resposta e permitir rate limit/observabilidade.
 */

/// A consulta de CNPJ atravessa a Receita e passa de 8s com frequência.
/// Abortar cedo demais transformava resposta lenta em "serviço indisponível".
const TIMEOUT_CNPJ_MS = 15_000;
const TIMEOUT_CEP_MS = 8_000;

export class InvalidDocumentError extends Error {}
export class LookupNotFoundError extends Error {}
export class LookupUnavailableError extends Error {}

type RespostaHttp = { ok: boolean; status: number; data: Record<string, unknown>; corpo: string };

/**
 * O `fetch` do Node (undici) não envia User-Agent por padrão, e a borda que
 * serve a BrasilAPI trata requisição sem identificação como tráfego suspeito —
 * respondia bloqueando, o que aqui virava "serviço indisponível". Um
 * User-Agent honesto resolve.
 */
const USER_AGENT = 'GestaoOperacional/1.0 (+consulta de cadastro)';

async function fetchJson(url: string, timeoutMs: number): Promise<RespostaHttp> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    // Lê como texto antes de interpretar: quando a resposta não é JSON (página
    // de bloqueio, HTML de erro), é o corpo cru que diz o que aconteceu.
    const corpo = await response.text().catch(() => '');
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(corpo) as Record<string, unknown>;
    } catch {
      // Mantém `data` vazio; `corpo` vai para o log de diagnóstico.
    }

    return { ok: response.ok, status: response.status, data, corpo };
  } finally {
    clearTimeout(timeout);
  }
}

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/**
 * Extrai um campo como texto.
 *
 * As duas APIs são inconsistentes sobre o tipo: `cep` e `numero` chegam ora
 * como string, ora como número. A versão anterior exigia `typeof === 'string'`
 * e descartava silenciosamente os valores numéricos — era por isso que o CEP e
 * o número do endereço voltavam vazios mesmo com a consulta bem-sucedida.
 */
function texto(data: Record<string, unknown>, chave: string): string | null {
  const valor = data[chave];
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  return null;
}

/**
 * Monta o logradouro completo.
 *
 * A Receita guarda o tipo separado do nome: `descricao_tipo_de_logradouro`
 * = "RUA" e `logradouro` = "BELA VISTA". Usar só o segundo campo gravava
 * "BELA VISTA" como endereço, sem o "RUA".
 */
function logradouroCompleto(data: Record<string, unknown>): string | null {
  const nome = texto(data, 'logradouro');
  if (!nome) return null;

  const tipo = texto(data, 'descricao_tipo_de_logradouro');
  // Alguns registros já trazem o tipo embutido no nome; não duplica.
  if (!tipo || nome.toUpperCase().startsWith(tipo.toUpperCase())) return nome;
  return `${tipo} ${nome}`;
}

/// A Receita devolve DDD e número colados ("6134939002"); a máscara fica a
/// cargo do frontend, aqui só garantimos que são dígitos.
function telefone(data: Record<string, unknown>, ...chaves: string[]): string | null {
  for (const chave of chaves) {
    const valor = texto(data, chave);
    const digits = valor ? onlyDigits(valor) : '';
    if (digits.length >= 10) return digits;
  }
  return null;
}

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
  /// Qual fonte respondeu. Aparece na tela e nos logs — sem isso, diagnosticar
  /// uma falha de consulta em produção vira adivinhação.
  fonte: string;
};

type ProvedorCnpj = {
  nome: string;
  url: (cnpj: string) => string;
  mapear: (data: Record<string, unknown>, cnpj: string) => Omit<CnpjLookupResult, 'fonte'>;
};

const PROVEDORES_CNPJ: ProvedorCnpj[] = [
  {
    nome: 'BrasilAPI',
    url: (cnpj) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    mapear: (data, cnpj) => ({
      cnpj,
      razaoSocial: texto(data, 'razao_social'),
      nomeFantasia: texto(data, 'nome_fantasia'),
      situacao: texto(data, 'descricao_situacao_cadastral'),
      telefone: telefone(data, 'ddd_telefone_1', 'ddd_telefone_2'),
      email: texto(data, 'email'),
      cep: texto(data, 'cep') ? onlyDigits(texto(data, 'cep')!) : null,
      logradouro: logradouroCompleto(data),
      numero: texto(data, 'numero'),
      complemento: texto(data, 'complemento'),
      bairro: texto(data, 'bairro'),
      cidade: texto(data, 'municipio'),
      uf: texto(data, 'uf'),
    }),
  },
  {
    // Mesma base da Receita, hospedagem independente. Os nomes dos campos
    // batem com os da BrasilAPI, mas o telefone vem separado em DDD + número.
    nome: 'Minha Receita',
    url: (cnpj) => `https://minhareceita.org/${cnpj}`,
    mapear: (data, cnpj) => {
      const ddd = texto(data, 'ddd_telefone_1');
      return {
        cnpj,
        razaoSocial: texto(data, 'razao_social'),
        nomeFantasia: texto(data, 'nome_fantasia'),
        situacao: texto(data, 'descricao_situacao_cadastral'),
        telefone: ddd ? onlyDigits(ddd) : null,
        email: texto(data, 'email'),
        cep: texto(data, 'cep') ? onlyDigits(texto(data, 'cep')!) : null,
        logradouro: logradouroCompleto(data),
        numero: texto(data, 'numero'),
        complemento: texto(data, 'complemento'),
        bairro: texto(data, 'bairro'),
        cidade: texto(data, 'municipio'),
        uf: texto(data, 'uf'),
      };
    },
  },
];

export async function lookupCnpj(cnpjBruto: string): Promise<CnpjLookupResult> {
  const cnpj = onlyDigits(cnpjBruto);
  if (!isValidCnpj(cnpj)) throw new InvalidDocumentError('CNPJ inválido');

  const motivos: string[] = [];

  for (const provedor of PROVEDORES_CNPJ) {
    let resultado: RespostaHttp;
    try {
      resultado = await fetchJson(provedor.url(cnpj), TIMEOUT_CNPJ_MS);
    } catch (error) {
      // AbortError = estourou o tempo; qualquer outra coisa é rede/DNS.
      const causa = error instanceof Error && error.name === 'AbortError' ? 'tempo esgotado' : 'falha de rede';
      motivos.push(`${provedor.nome}: ${causa}`);
      continue;
    }

    // 404 é resposta definitiva: o CNPJ não existe na base. Tentar a segunda
    // fonte não mudaria nada e só faria o usuário esperar mais.
    if (resultado.status === 404) throw new LookupNotFoundError('CNPJ não encontrado na base da Receita Federal');

    if (!resultado.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[lookup] ${provedor.nome} recusou o CNPJ ${cnpj}: HTTP ${resultado.status} — ${resultado.corpo.slice(0, 300)}`);
      motivos.push(`${provedor.nome}: HTTP ${resultado.status}${resultado.status === 429 ? ' (limite de consultas)' : ''}`);
      continue;
    }

    const mapeado = provedor.mapear(resultado.data, cnpj);
    // Resposta 200 sem razão social é resposta vazia disfarçada: segue para a
    // próxima fonte em vez de devolver um formulário em branco.
    if (!mapeado.razaoSocial) {
      motivos.push(`${provedor.nome}: resposta sem dados`);
      continue;
    }

    return { ...mapeado, fonte: provedor.nome };
  }

  // eslint-disable-next-line no-console
  console.warn(`[lookup] CNPJ ${cnpj} não pôde ser consultado — ${motivos.join('; ')}`);
  throw new LookupUnavailableError(
    `Nenhuma das fontes de consulta respondeu (${motivos.join('; ')}). Preencha manualmente e tente de novo depois.`
  );
}

export type CepLookupResult = {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: string;
};

export async function lookupCep(cepBruto: string): Promise<CepLookupResult> {
  const cep = onlyDigits(cepBruto);
  if (cep.length !== 8) throw new InvalidDocumentError('CEP deve ter 8 dígitos');

  const motivos: string[] = [];

  // Tentativa 1: BrasilAPI (agrega várias fontes).
  try {
    const resultado = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, TIMEOUT_CEP_MS);
    if (resultado.status === 404) throw new LookupNotFoundError('CEP não encontrado');
    if (resultado.ok) {
      const data = resultado.data;
      return {
        cep,
        logradouro: texto(data, 'street'),
        bairro: texto(data, 'neighborhood'),
        cidade: texto(data, 'city'),
        uf: texto(data, 'state'),
        fonte: 'BrasilAPI',
      };
    }
    motivos.push(`BrasilAPI: HTTP ${resultado.status}`);
  } catch (error) {
    if (error instanceof LookupNotFoundError) throw error;
    motivos.push('BrasilAPI: falha de rede');
  }

  // Tentativa 2: ViaCEP.
  try {
    const resultado = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`, TIMEOUT_CEP_MS);
    // O ViaCEP responde 200 com `{ erro: true }` para CEP inexistente.
    if (resultado.ok && resultado.data.erro) throw new LookupNotFoundError('CEP não encontrado');
    if (resultado.ok) {
      const data = resultado.data;
      return {
        cep,
        logradouro: texto(data, 'logradouro'),
        bairro: texto(data, 'bairro'),
        cidade: texto(data, 'localidade'),
        uf: texto(data, 'uf'),
        fonte: 'ViaCEP',
      };
    }
    motivos.push(`ViaCEP: HTTP ${resultado.status}`);
  } catch (error) {
    if (error instanceof LookupNotFoundError) throw error;
    motivos.push('ViaCEP: falha de rede');
  }

  // eslint-disable-next-line no-console
  console.warn(`[lookup] CEP ${cep} não pôde ser consultado — ${motivos.join('; ')}`);
  throw new LookupUnavailableError(
    `Nenhuma das fontes de consulta respondeu (${motivos.join('; ')}). Preencha o endereço manualmente.`
  );
}
