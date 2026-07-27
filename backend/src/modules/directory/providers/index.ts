import type { DirectoryProviderType } from '@prisma/client';
import type { DirectoryProvider } from './provider.types';
import { EntraIdProvider } from './entra/entra.provider';

/**
 * Ponto único de instanciação de provedor.
 *
 * O serviço nunca escreve `new EntraIdProvider`: pede pelo tipo e recebe o
 * contrato. É o que faz a adição de Google Workspace, Okta ou LDAP ser uma
 * entrada nova neste `switch` mais um arquivo em `providers/`, sem tocar em
 * motor, serviço ou controller.
 */

export class ProvedorNaoSuportadoError extends Error {}

export type CredenciaisDoProvedor = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  authorityUrl?: string | null;
};

export function criarProvider(tipo: DirectoryProviderType, credenciais: CredenciaisDoProvedor): DirectoryProvider {
  switch (tipo) {
    case 'entra':
      return new EntraIdProvider(credenciais);
    case 'google':
    case 'okta':
    case 'ldap':
      throw new ProvedorNaoSuportadoError(
        `A integração com ${tipo} ainda não foi implementada. Por ora, apenas o Microsoft Entra ID está disponível.`
      );
    default: {
      // Garante em tempo de compilação que um provedor novo no enum não passe
      // despercebido por aqui.
      const exaustivo: never = tipo;
      throw new ProvedorNaoSuportadoError(`Provedor desconhecido: ${String(exaustivo)}`);
    }
  }
}

export type { DirectoryProvider, ResultadoDoTeste, VerificacaoDeAcesso } from './provider.types';
