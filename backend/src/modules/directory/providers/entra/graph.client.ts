import { env } from '../../../../config/env';

/**
 * Cliente do Microsoft Graph.
 *
 * Concentra o que é chato e fácil de errar: obter e reaproveitar o token,
 * respeitar o `Retry-After` quando a Microsoft limita a taxa, repetir o que
 * vale a pena repetir e traduzir os códigos AADSTS para algo que quem
 * configura consiga agir. Nada além deste arquivo e do mapper conhece o
 * vocabulário da Microsoft.
 */

export type GraphCredenciais = {
  /// Tenant NO PROVEDOR (o Directory ID do Entra), não o tenant da aplicação.
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /// Sobrescreve a authority do ambiente — nuvens soberanas, ambiente de teste.
  authorityUrl?: string | null;
};

/// Credencial rejeitada pelo Entra: cliente inexistente, segredo errado ou
/// vencido, tenant que não existe. Nunca é problema de permissão.
export class GraphAuthError extends Error {
  constructor(message: string, readonly codigo: string | null = null) {
    super(message);
  }
}

/// Autenticou, mas a App Registration não recebeu consentimento para ler
/// aquele recurso. Carrega qual permissão falta.
export class GraphPermissionError extends Error {
  constructor(message: string, readonly permissao: string) {
    super(message);
  }
}

/// Limite de taxa. `esperarSegundos` vem do cabeçalho `Retry-After` — inventar
/// um backoff próprio ignorando esse número é o caminho mais rápido para um
/// bloqueio prolongado do app no tenant.
export class GraphThrottleError extends Error {
  constructor(message: string, readonly esperarSegundos: number) {
    super(message);
  }
}

export class GraphRequestError extends Error {
  constructor(message: string, readonly status: number, readonly codigo: string | null = null) {
    super(message);
  }
}

const TIMEOUT_MS = 30_000;
const MAX_TENTATIVAS = 4;
/// Teto do respiro pedido pela Microsoft. Ela raramente pede mais que alguns
/// segundos, mas um `Retry-After` absurdo não pode prender a execução.
const ESPERA_MAXIMA_S = 60;

/**
 * Tradução dos códigos AADSTS que aparecem de verdade em uma configuração
 * nova. Sem isso, quem configura recebe um parágrafo em inglês com um link
 * genérico e não sabe qual dos quatro campos do formulário está errado.
 */
const MENSAGENS_AADSTS: Array<{ codigo: string; mensagem: string }> = [
  {
    codigo: 'AADSTS7000215',
    mensagem: 'Segredo do cliente inválido. Confira se copiou o *Value* do segredo no portal do Entra, e não o *Secret ID*.',
  },
  {
    codigo: 'AADSTS7000222',
    mensagem: 'O segredo do cliente venceu. Gere um novo em Certificates & secrets na App Registration e cadastre aqui.',
  },
  {
    codigo: 'AADSTS700016',
    mensagem: 'A aplicação não foi encontrada neste tenant. Confira o Application (client) ID e se a App Registration pertence ao tenant informado.',
  },
  {
    codigo: 'AADSTS90002',
    mensagem: 'Tenant não encontrado. Confira o Directory (tenant) ID — ele é um GUID, não o nome do domínio.',
  },
  {
    codigo: 'AADSTS900023',
    mensagem: 'Tenant não encontrado. Confira o Directory (tenant) ID — ele é um GUID, não o nome do domínio.',
  },
  {
    codigo: 'AADSTS7000229',
    mensagem: 'A aplicação não está habilitada para o fluxo de credenciais de cliente neste tenant.',
  },
  {
    codigo: 'AADSTS500011',
    mensagem: 'O recurso solicitado não existe no tenant. Verifique se a App Registration tem permissões de aplicação do Microsoft Graph.',
  },
];

function traduzirErroDeAuth(descricao: string): { mensagem: string; codigo: string | null } {
  const encontrado = MENSAGENS_AADSTS.find((item) => descricao.includes(item.codigo));
  if (encontrado) return { mensagem: encontrado.mensagem, codigo: encontrado.codigo };

  const codigo = descricao.match(/AADSTS\d+/)?.[0] ?? null;
  // Sem tradução conhecida, a primeira frase da Microsoft é mais útil que o
  // parágrafo inteiro com trace ID e timestamp.
  const primeiraFrase = descricao.split(/\.\s|\r?\n/)[0]?.trim();
  return { mensagem: primeiraFrase || 'O Entra ID recusou as credenciais informadas.', codigo };
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// `Retry-After` chega em segundos ou como data HTTP. Aceita as duas.
function segundosDeEspera(cabecalho: string | null): number {
  if (!cabecalho) return 0;

  const segundos = Number(cabecalho);
  if (Number.isFinite(segundos)) return Math.min(Math.max(segundos, 0), ESPERA_MAXIMA_S);

  const data = Date.parse(cabecalho);
  if (Number.isNaN(data)) return 0;
  return Math.min(Math.max(Math.ceil((data - Date.now()) / 1000), 0), ESPERA_MAXIMA_S);
}

async function fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/// Corpo de erro do Graph: `{ error: { code, message } }`.
function extrairErroDoGraph(corpo: string): { codigo: string | null; mensagem: string | null } {
  try {
    const json = JSON.parse(corpo);
    return { codigo: json?.error?.code ?? null, mensagem: json?.error?.message ?? null };
  } catch {
    return { codigo: null, mensagem: null };
  }
}

export type GraphClient = {
  obterToken(): Promise<string>;
  /// GET no Graph, já autenticado, com repetição e tradução de erro.
  get<T = unknown>(caminho: string, opcoes?: { consistenciaEventual?: boolean }): Promise<T>;
};

export function criarGraphClient(credenciais: GraphCredenciais): GraphClient {
  const authority = (credenciais.authorityUrl || env.entraAuthorityUrl).replace(/\/+$/, '');
  const base = `${env.graphApiBaseUrl}/${env.graphApiVersion}`;

  /// Token de aplicação vale ~1h e serve a todas as chamadas da execução.
  /// Guardado com folga de 60s para não usar um token que expira no caminho.
  let tokenCache: { valor: string; expiraEm: number } | null = null;

  async function obterToken(): Promise<string> {
    if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) return tokenCache.valor;

    const url = `${authority}/${encodeURIComponent(credenciais.tenantId)}/oauth2/v2.0/token`;
    const corpo = new URLSearchParams({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      // `.default` pede exatamente as permissões de aplicação já consentidas —
      // é o fluxo correto para client credentials, onde não há usuário.
      scope: `${env.graphApiBaseUrl}/.default`,
      grant_type: 'client_credentials',
    });

    let resposta: Response;
    try {
      resposta = await fetchComTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corpo.toString(),
      });
    } catch (error) {
      const motivo = error instanceof Error && error.name === 'AbortError' ? 'tempo esgotado' : 'falha de rede';
      throw new GraphAuthError(
        `Não foi possível falar com o Entra ID (${motivo}). Confira a saída de rede do servidor para ${authority}.`
      );
    }

    const texto = await resposta.text();

    if (!resposta.ok) {
      let descricao = texto;
      try {
        const json = JSON.parse(texto);
        descricao = json.error_description || json.error || texto;
      } catch {
        // Resposta não-JSON (proxy no caminho, por exemplo): usa o texto cru.
      }
      const { mensagem, codigo } = traduzirErroDeAuth(String(descricao));
      throw new GraphAuthError(mensagem, codigo);
    }

    const json = JSON.parse(texto) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new GraphAuthError('O Entra ID respondeu sem token de acesso.');

    tokenCache = {
      valor: json.access_token,
      expiraEm: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return tokenCache.valor;
  }

  async function get<T>(caminho: string, opcoes: { consistenciaEventual?: boolean } = {}): Promise<T> {
    // Aceita caminho relativo ou URL absoluta (é o formato do `@odata.nextLink`).
    const url = caminho.startsWith('http') ? caminho : `${base}${caminho.startsWith('/') ? '' : '/'}${caminho}`;

    let ultimoErro: unknown = null;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
      const token = await obterToken();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      // `$count` e alguns filtros exigem consistência eventual declarada.
      if (opcoes.consistenciaEventual) headers.ConsistencyLevel = 'eventual';

      let resposta: Response;
      try {
        resposta = await fetchComTimeout(url, { method: 'GET', headers });
      } catch (error) {
        ultimoErro = error;
        if (tentativa === MAX_TENTATIVAS) {
          const motivo = error instanceof Error && error.name === 'AbortError' ? 'tempo esgotado' : 'falha de rede';
          throw new GraphRequestError(`Não foi possível falar com o Microsoft Graph (${motivo}).`, 0);
        }
        await dormir(2 ** tentativa * 500);
        continue;
      }

      if (resposta.ok) return (await resposta.json()) as T;

      const texto = await resposta.text();
      const { codigo, mensagem } = extrairErroDoGraph(texto);

      // 429: a Microsoft diz quanto esperar. Obedecer é o que evita escalar
      // para um bloqueio mais longo.
      if (resposta.status === 429) {
        const espera = segundosDeEspera(resposta.headers.get('Retry-After')) || 2 ** tentativa;
        if (tentativa === MAX_TENTATIVAS) {
          throw new GraphThrottleError(
            `O Microsoft Graph está limitando as requisições. Tente novamente em ${espera}s.`,
            espera
          );
        }
        await dormir(espera * 1000);
        continue;
      }

      // O token pode ter sido invalidado no meio do caminho (segredo trocado
      // no portal). Descarta o cache e tenta de novo — uma vez só.
      if (resposta.status === 401 && tentativa < MAX_TENTATIVAS) {
        tokenCache = null;
        continue;
      }

      if (resposta.status === 403 || codigo === 'Authorization_RequestDenied') {
        throw new GraphPermissionError(
          mensagem || 'A aplicação não tem permissão para ler este recurso.',
          codigo || 'Authorization_RequestDenied'
        );
      }

      if (resposta.status >= 500 && tentativa < MAX_TENTATIVAS) {
        await dormir(2 ** tentativa * 500);
        continue;
      }

      throw new GraphRequestError(
        mensagem || `O Microsoft Graph respondeu ${resposta.status}.`,
        resposta.status,
        codigo
      );
    }

    // Inalcançável: todo caminho do laço retorna ou lança.
    throw new GraphRequestError(
      ultimoErro instanceof Error ? ultimoErro.message : 'Falha ao consultar o Microsoft Graph.',
      0
    );
  }

  return { obterToken, get };
}
