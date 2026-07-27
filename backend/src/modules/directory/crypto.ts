import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Cifragem dos segredos de conexão com o provedor de identidade.
 *
 * O `clientSecret` da App Registration é credencial de leitura do diretório
 * inteiro de uma empresa. Ele fica no banco (é config por empresa, não por
 * deployment), mas nunca em claro: um dump de banco, sozinho, não deve
 * entregar acesso ao Entra de ninguém. A chave mora no ambiente.
 *
 * AES-256-GCM porque autentica além de cifrar — texto adulterado falha na
 * verificação da tag em vez de decifrar em lixo silencioso.
 */

const ALGORITMO = 'aes-256-gcm';
const VERSAO = 'v1';
const TAMANHO_IV = 12; // 96 bits, o recomendado para GCM
const TAMANHO_CHAVE = 32;

/// Sal fixo da derivação. Não é segredo — o que protege é o custo do scrypt
/// somado à entropia da chave. Fixo porque a derivação precisa ser
/// reprodutível a cada boot sem guardar estado.
const SAL_DERIVACAO = 'gestao-operacional/diretorio/v1';

export class ChaveDeCifragemAusenteError extends Error {}
export class PacoteCifradoInvalidoError extends Error {}

/**
 * Resolve a chave de 32 bytes a partir de `DIRECTORY_ENCRYPTION_KEY`.
 *
 * Aceita duas formas para não obrigar ninguém a decorar formato:
 * material de 32 bytes em hex ou base64 é usado direto (o caminho recomendado,
 * `openssl rand -base64 32`); qualquer outra coisa com pelo menos 32
 * caracteres é tratada como frase e passa por scrypt.
 */
function resolverChave(): Buffer {
  const bruto = env.directoryEncryptionKey;

  if (!bruto) {
    throw new ChaveDeCifragemAusenteError(
      'DIRECTORY_ENCRYPTION_KEY não está configurada. Gere uma com `openssl rand -base64 32` e defina no ambiente do backend — sem ela não há como guardar o segredo do provedor com segurança.'
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(bruto)) return Buffer.from(bruto, 'hex');

  const base64 = Buffer.from(bruto, 'base64');
  if (base64.length === TAMANHO_CHAVE && Buffer.from(base64).toString('base64').replace(/=+$/, '') === bruto.replace(/=+$/, '')) {
    return base64;
  }

  if (bruto.length < 32) {
    throw new ChaveDeCifragemAusenteError(
      'DIRECTORY_ENCRYPTION_KEY é curta demais. Use 32 bytes em hex ou base64 (`openssl rand -base64 32`), ou uma frase de no mínimo 32 caracteres.'
    );
  }

  return scryptSync(bruto, SAL_DERIVACAO, TAMANHO_CHAVE);
}

/// A derivação por scrypt custa caro de propósito; fazer isso a cada gravação
/// seria desperdício. Resolvida uma vez, na primeira necessidade.
let chaveCache: Buffer | null = null;

function chave(): Buffer {
  if (!chaveCache) chaveCache = resolverChave();
  return chaveCache;
}

/// Existe para os testes: eles trocam a variável de ambiente em tempo de
/// execução e precisam que a próxima chamada releia.
export function limparCacheDeChave() {
  chaveCache = null;
}

export function temChaveDeCifragem(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}

/**
 * Cifra um segredo. O `contexto` entra como dado autenticado adicional (AAD):
 * um pacote cifrado para a empresa 7 não decifra como se fosse da empresa 9,
 * mesmo com a mesma chave. Isso transforma "copiar linha entre tenants" de
 * falha silenciosa em erro.
 */
export function cifrar(texto: string, contexto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  cipher.setAAD(Buffer.from(contexto, 'utf8'));

  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSAO, iv.toString('base64'), tag.toString('base64'), cifrado.toString('base64')].join('.');
}

export function decifrar(pacote: string, contexto: string): string {
  const partes = pacote.split('.');
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new PacoteCifradoInvalidoError('Formato do segredo cifrado não reconhecido');
  }

  const [, ivB64, tagB64, cifradoB64] = partes;

  try {
    const decipher = createDecipheriv(ALGORITMO, chave(), Buffer.from(ivB64, 'base64'));
    decipher.setAAD(Buffer.from(contexto, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(cifradoB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Distinguir "tag errada" de "chave errada" de "contexto errado" daria a
    // quem tem o banco um oráculo para testar hipóteses. Uma mensagem só.
    throw new PacoteCifradoInvalidoError(
      'Não foi possível decifrar o segredo da conexão. Isso acontece quando DIRECTORY_ENCRYPTION_KEY mudou depois que o segredo foi salvo — cadastre o segredo novamente.'
    );
  }
}

/// Contexto de cifragem de uma conexão. Amarra o pacote à empresa dona dele.
export function contextoDaConexao(tenantId: number): string {
  return `diretorio:tenant:${tenantId}`;
}

/**
 * Impressão digital do segredo, para a tela confirmar "é o mesmo de antes?"
 * sem nunca devolver o valor. Trunca em 8 caracteres: suficiente para
 * comparar visualmente, curto demais para atacar por força bruta com proveito.
 */
export function impressaoDigital(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex').slice(0, 8);
}
