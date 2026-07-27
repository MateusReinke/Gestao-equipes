import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

/// Lista separada por vírgula, ignorando entradas vazias.
function parseList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/// `true`/`1`/`yes` ligam; qualquer outra coisa desliga. Ausente cai no padrão.
function parseBool(value: string | undefined, padrao: boolean): boolean {
  if (value == null || value.trim() === '') return padrao;
  return ['true', '1', 'yes', 'sim'].includes(value.trim().toLowerCase());
}

export const env = {
  appPort: Number(process.env.APP_PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: requireEnv('JWT_SECRET'),
  /// Origens liberadas para chamar a API direto do navegador.
  /// Vazio (padrão) = nenhuma: o frontend fala com a API pelo servidor.
  corsOrigins: parseList(process.env.CORS_ORIGINS),

  /// Interruptor geral do módulo de diretório. Desligado, as rotas respondem
  /// 503 e nada é agendado — o módulo não existe para quem não o habilitou.
  enableEntraSync: parseBool(process.env.ENABLE_ENTRA_SYNC, false),

  /// Chave mestra que cifra os segredos de conexão guardados no banco.
  /// Deliberadamente NÃO é `requireEnv`: instalações que não usam diretório
  /// não devem ser impedidas de subir. Quem tenta salvar uma conexão sem ela
  /// recebe um erro explicando o que fazer.
  directoryEncryptionKey: process.env.DIRECTORY_ENCRYPTION_KEY || '',

  /// Endpoints do provedor. Ficam no ambiente porque são do deployment (e
  /// mudam em nuvens soberanas), não da empresa. Já as credenciais são por
  /// empresa e moram no banco, cifradas.
  graphApiBaseUrl: (process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com').replace(/\/+$/, ''),
  graphApiVersion: process.env.GRAPH_API_VERSION || 'v1.0',
  entraAuthorityUrl: (process.env.ENTRA_AUTHORITY_URL || 'https://login.microsoftonline.com').replace(/\/+$/, ''),

  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 60),
};

/**
 * Padrões das flags de sincronização.
 *
 * Elas são configuração POR EMPRESA (ficam em `diretorio_conexoes.opcoes`),
 * mas o ambiente define o valor inicial de cada uma — é o que permite a um
 * deployment inteiro começar mais conservador ou mais automático.
 *
 * `autoCriarColaboradores` e `autoDesativarColaboradores` nascem desligadas
 * de propósito: são as duas únicas que alcançam dado operacional.
 */
export const directoryDefaults = {
  sincronizarUsuarios: parseBool(process.env.SYNC_USERS, true),
  sincronizarDepartamentos: parseBool(process.env.SYNC_DEPARTMENTS, true),
  sincronizarCargos: parseBool(process.env.SYNC_JOB_TITLES, true),
  sincronizarGestores: parseBool(process.env.SYNC_MANAGERS, true),
  sincronizarFotos: parseBool(process.env.SYNC_PHOTOS, false),
  sincronizarGrupos: parseBool(process.env.SYNC_GROUPS, false),
  /// Conta desabilitada continua entrando no espelho: sumir com ela apagaria
  /// o nome de quem aparece no histórico de escalas.
  sincronizarUsuariosDesabilitados: parseBool(process.env.SYNC_DISABLED_USERS, true),
  autoCriarColaboradores: parseBool(process.env.AUTO_CREATE_USERS, false),
  autoDesativarColaboradores: parseBool(process.env.AUTO_DISABLE_USERS, false),
  logOperacoes: parseBool(process.env.LOG_SYNC_OPERATIONS, true),
  sincronizacaoCompletaNaPrimeira: parseBool(process.env.FULL_SYNC_ON_FIRST_RUN, true),
  intervaloMinutos: Number(process.env.SYNC_INTERVAL_MINUTES || 60),
  paisPadrao: process.env.DEFAULT_COUNTRY || 'BR',
  fusoHorarioPadrao: process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo',
  idiomaPadrao: process.env.DEFAULT_LANGUAGE || 'pt-BR',
};

export type DirectoryOptions = typeof directoryDefaults;
