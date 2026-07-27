import type {
  DirectoryProvider,
  OpcoesDeLeitura,
  PaginaDePessoas,
  ResultadoDoTeste,
  VerificacaoDeAcesso,
} from '../provider.types';
import { CAMPOS_DE_USUARIO, mapearUsuario, type UsuarioGraph } from './entra.mapper';
import {
  GraphAuthError,
  GraphPermissionError,
  GraphThrottleError,
  criarGraphClient,
  type GraphClient,
  type GraphCredenciais,
} from './graph.client';

/**
 * Provedor Microsoft Entra ID.
 *
 * Primeira implementação de `DirectoryProvider`. Tudo que é específico da
 * Microsoft — nomes de permissão, endpoints, formato de resposta — para aqui.
 */

type RespostaOrganizacao = {
  value?: Array<{
    id?: string;
    displayName?: string;
    verifiedDomains?: Array<{ name?: string; isDefault?: boolean }>;
  }>;
};

type RespostaContagem = {
  '@odata.count'?: number;
  value?: unknown[];
};

/// Formata contagem no padrão brasileiro (1.284, não 1,284).
function contar(valor: number | undefined, singular: string, plural: string): string {
  if (valor == null) return `Acesso confirmado (${plural} legíveis)`;
  const formatado = valor.toLocaleString('pt-BR');
  return `${formatado} ${valor === 1 ? singular : plural}`;
}

export class EntraIdProvider implements DirectoryProvider {
  readonly tipo = 'entra' as const;
  private readonly graph: GraphClient;

  constructor(credenciais: GraphCredenciais) {
    this.graph = criarGraphClient(credenciais);
  }

  /**
   * Roda o diagnóstico de configuração.
   *
   * Falha de credencial e falta de permissão são RESULTADOS do teste, não
   * exceções — é justamente isso que o teste existe para descobrir. Cada
   * recurso é verificado em separado porque o consentimento de administrador
   * costuma ser concedido pela metade, e um "falhou" único deixaria quem
   * configura sem saber qual permissão liberar.
   */
  async testarConexao(): Promise<ResultadoDoTeste> {
    try {
      await this.graph.obterToken();
    } catch (error) {
      if (error instanceof GraphAuthError) {
        return { ok: false, organizacao: null, verificacoes: [], erro: error.message };
      }
      if (error instanceof GraphThrottleError) {
        return { ok: false, organizacao: null, verificacoes: [], erro: error.message };
      }
      throw error;
    }

    // Autenticou: daqui para frente o que se mede é permissão, e cada
    // verificação é independente das outras.
    const [organizacao, usuarios, grupos] = await Promise.all([
      this.verificarOrganizacao(),
      this.verificarUsuarios(),
      this.verificarGrupos(),
    ]);

    const verificacoes = [organizacao.verificacao, usuarios, grupos];
    const ok = verificacoes.every((item) => item.ok || !item.obrigatoria);

    return { ok, organizacao: organizacao.dados, verificacoes, erro: null };
  }

  /**
   * Percorre as contas do tenant.
   *
   * Sempre por `/users/delta`, mesmo na leitura completa — e é isso que torna a
   * sincronização incremental possível: só o endpoint delta devolve, na última
   * página, o `@odata.deltaLink` que serve de cursor para a próxima execução.
   * Uma carga por `/users` comum leria tudo e não deixaria por onde continuar.
   *
   * O preço é não poder filtrar desabilitadas no servidor: o delta aceita um
   * conjunto restrito de filtros, e `accountEnabled` não está garantido nele.
   * Trazer as contas e deixar o motor decidir custa banda, mas é o único jeito
   * de a leitura incremental enxergar quem ACABOU de ser desabilitado.
   */
  async *listarPessoas(opcoes: OpcoesDeLeitura): AsyncGenerator<PaginaDePessoas> {
    // Cursor guardado é o deltaLink inteiro, com os próprios parâmetros de
    // consulta embutidos. Reescrevê-los invalidaria o token.
    const caminho = opcoes.cursor ?? `/users/delta?$select=${CAMPOS_DE_USUARIO}`;

    for await (const pagina of this.graph.paginar<UsuarioGraph>(caminho)) {
      const pessoas = pagina.itens
        .map((usuario) => mapearUsuario(usuario))
        // Objeto sem Object ID não tem chave de vínculo. Raro, mas acontece
        // com resultado parcial do Graph — e vincular por e-mail no lugar é
        // exatamente o que não se deve fazer.
        .filter((pessoa): pessoa is NonNullable<typeof pessoa> => pessoa !== null);

      yield { pessoas, cursor: pagina.deltaLink };
    }
  }

  /// Confirma que as credenciais apontam para o tenant que quem configura
  /// acredita estar configurando — errar o Directory ID e cair no tenant de
  /// outra empresa é o engano silencioso mais caro dessa tela.
  private async verificarOrganizacao(): Promise<{
    verificacao: VerificacaoDeAcesso;
    dados: ResultadoDoTeste['organizacao'];
  }> {
    const base: Omit<VerificacaoDeAcesso, 'ok' | 'detalhe'> = {
      recurso: 'Organização',
      permissao: 'Organization.Read.All',
      obrigatoria: false,
    };

    try {
      const resposta = await this.graph.get<RespostaOrganizacao>('/organization?$select=id,displayName,verifiedDomains');
      const org = resposta.value?.[0];

      if (!org) {
        return {
          verificacao: { ...base, ok: false, detalhe: 'O Entra respondeu sem dados da organização.' },
          dados: null,
        };
      }

      const dominios = (org.verifiedDomains ?? [])
        .map((dominio) => dominio.name)
        .filter((nome): nome is string => Boolean(nome));

      return {
        verificacao: {
          ...base,
          ok: true,
          detalhe: org.displayName ? `Conectado a "${org.displayName}"` : 'Organização legível',
        },
        dados: { nome: org.displayName ?? 'Organização sem nome', tenantId: org.id ?? '', dominios },
      };
    } catch (error) {
      return { verificacao: { ...base, ok: false, detalhe: this.explicar(error, 'a organização') }, dados: null };
    }
  }

  /// A única obrigatória: sem ler usuários não há sincronização nenhuma.
  private async verificarUsuarios(): Promise<VerificacaoDeAcesso> {
    const base: Omit<VerificacaoDeAcesso, 'ok' | 'detalhe'> = {
      recurso: 'Usuários',
      permissao: 'User.Read.All',
      obrigatoria: true,
    };

    try {
      const resposta = await this.graph.get<RespostaContagem>('/users?$select=id&$top=1&$count=true', {
        consistenciaEventual: true,
      });
      return { ...base, ok: true, detalhe: contar(resposta['@odata.count'], 'conta', 'contas') };
    } catch (error) {
      return { ...base, ok: false, detalhe: this.explicar(error, 'os usuários') };
    }
  }

  /// Opcional: grupos só entram quando a empresa liga a flag correspondente.
  private async verificarGrupos(): Promise<VerificacaoDeAcesso> {
    const base: Omit<VerificacaoDeAcesso, 'ok' | 'detalhe'> = {
      recurso: 'Grupos',
      permissao: 'Group.Read.All',
      obrigatoria: false,
    };

    try {
      const resposta = await this.graph.get<RespostaContagem>('/groups?$select=id&$top=1&$count=true', {
        consistenciaEventual: true,
      });
      return { ...base, ok: true, detalhe: contar(resposta['@odata.count'], 'grupo', 'grupos') };
    } catch (error) {
      return { ...base, ok: false, detalhe: this.explicar(error, 'os grupos') };
    }
  }

  /// Converte a falha em instrução. Permissão negada é o caso comum e tem
  /// caminho fixo no portal, então vale gastar a frase inteira nele.
  private explicar(error: unknown, oQue: string): string {
    if (error instanceof GraphPermissionError) {
      return `Sem permissão para ler ${oQue}. No portal do Entra, abra a App Registration > API permissions, adicione a permissão de aplicação correspondente e clique em "Grant admin consent".`;
    }
    if (error instanceof GraphThrottleError) {
      return `O Graph está limitando as requisições. Repita o teste em ${error.esperarSegundos}s.`;
    }
    if (error instanceof Error) return error.message;
    return `Não foi possível ler ${oQue}.`;
  }
}
