import type { PessoaDiretorio } from '../provider.types';

/**
 * Tradução do payload do Microsoft Graph para a forma canônica.
 *
 * Este arquivo e o `graph.client` são a fronteira: nada depois deles conhece
 * `userPrincipalName`, `accountEnabled` ou `@removed`. Trocar de provedor é
 * escrever outro mapper.
 */

/// Campos pedidos ao Graph. Explícito de propósito: `$select` reduz o payload
/// e, mais importante, deixa registrado o que este módulo lê do diretório de
/// alguém — auditável sem ler o código do mapper.
export const CAMPOS_DE_USUARIO = [
  'id',
  'displayName',
  'givenName',
  'surname',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'department',
  'companyName',
  'officeLocation',
  'businessPhones',
  'mobilePhone',
  'country',
  'city',
  'state',
  'preferredLanguage',
  'accountEnabled',
].join(',');

export type UsuarioGraph = {
  id?: string;
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  companyName?: string | null;
  officeLocation?: string | null;
  businessPhones?: string[] | null;
  mobilePhone?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  preferredLanguage?: string | null;
  accountEnabled?: boolean | null;
  manager?: { id?: string } | null;
  /// Marcador de objeto excluído, exclusivo das consultas delta.
  '@removed'?: { reason?: string } | null;
};

/// Texto vazio e texto só com espaço são a mesma coisa que ausente — e virar
/// string vazia no banco faria "departamento em branco" aparecer no catálogo.
function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}

/**
 * O Graph tem dois campos de e-mail e eles divergem com frequência: `mail` é o
 * endereço de caixa postal (pode ser nulo em conta sem licença), e
 * `userPrincipalName` é o login (sempre presente, às vezes com domínio
 * `.onmicrosoft.com` que ninguém usa para escrever).
 *
 * Preferimos `mail` porque é o endereço pelo qual a pessoa é encontrada, e
 * caímos no login quando não há caixa — melhor um endereço técnico do que
 * nenhum. Os dois ficam guardados; a reconciliação decide o que usar.
 */
function emailPreferido(usuario: UsuarioGraph): string | null {
  return texto(usuario.mail) ?? texto(usuario.userPrincipalName);
}

export function mapearUsuario(usuario: UsuarioGraph): PessoaDiretorio | null {
  const externalId = texto(usuario.id);
  // Sem Object ID não há chave de vínculo, e vincular por e-mail é justamente
  // o que a especificação proíbe. Objeto assim é descartado e registrado.
  if (!externalId) return null;

  return {
    externalId,
    // Conta de serviço às vezes vem sem displayName; o login é melhor rótulo
    // que um campo vazio na tela.
    nomeExibicao: texto(usuario.displayName) ?? texto(usuario.userPrincipalName) ?? externalId,
    primeiroNome: texto(usuario.givenName),
    sobrenome: texto(usuario.surname),
    email: emailPreferido(usuario),
    loginPrincipal: texto(usuario.userPrincipalName),
    cargo: texto(usuario.jobTitle),
    departamento: texto(usuario.department),
    empresa: texto(usuario.companyName),
    escritorio: texto(usuario.officeLocation),
    // `businessPhones` é lista; o primeiro é o que aparece no perfil.
    telefone: texto(usuario.businessPhones?.[0]),
    celular: texto(usuario.mobilePhone),
    pais: texto(usuario.country),
    cidade: texto(usuario.city),
    estado: texto(usuario.state),
    idioma: texto(usuario.preferredLanguage),
    // O Graph não expõe fuso horário em /users: ele vive em mailboxSettings e
    // exige outra permissão. Fica nulo, e o padrão da conexão o preenche.
    fusoHorario: null,
    // Ausente é tratado como habilitada: o campo só falta quando o `$select`
    // não o trouxe, e assumir "desabilitada" desativaria gente por engano se
    // a flag de auto-desativar estiver ligada.
    contaHabilitada: usuario.accountEnabled !== false,
    gestorExternalId: texto(usuario.manager?.id),
    removido: usuario['@removed'] != null,
    bruto: usuario,
  };
}
