import type {
  DirectoryProvider,
  OpcoesDeLeitura,
  PaginaDePessoas,
  PessoaDiretorio,
  ResultadoDoTeste,
} from './provider.types';
import { CursorExpiradoError } from './provider.types';

/**
 * Provedor de mentira, para os testes.
 *
 * Existe porque o motor de sincronização precisa ser exercitável sem rede — e
 * também porque `graph.microsoft.com` não é alcançável do ambiente onde este
 * código é desenvolvido. Todo comportamento do motor (primeira carga,
 * reexecução, pessoa que sumiu, falha no meio da leitura) se prova aqui; o que
 * só o Entra real pode provar é o mapeamento do payload dele.
 *
 * É também o segundo implementador do contrato `DirectoryProvider`, e é isso
 * que mantém a interface honesta: se ela vazasse vocabulário da Microsoft,
 * este arquivo não compilaria.
 */
export class FakeProvider implements DirectoryProvider {
  readonly tipo = 'entra' as const;

  constructor(
    private readonly config: {
      /// Roteiro da leitura completa (sem cursor).
      paginas: PessoaDiretorio[][];
      /// Roteiro da leitura incremental (com cursor).
      paginasIncrementais?: PessoaDiretorio[][];
      cursorFinal?: string | null;
      /// Faz a leitura com cursor estourar como se o token tivesse vencido.
      cursorExpirado?: boolean;
      /// Índice da página em que a leitura estoura, para exercitar o caminho
      /// de execução parcial.
      falharNaPagina?: number;
      resultadoDoTeste?: ResultadoDoTeste;
    }
  ) {}

  async testarConexao(): Promise<ResultadoDoTeste> {
    return (
      this.config.resultadoDoTeste ?? { ok: true, organizacao: null, verificacoes: [], erro: null }
    );
  }

  async *listarPessoas(opcoes: OpcoesDeLeitura): AsyncGenerator<PaginaDePessoas> {
    // Com cursor, entrega o roteiro incremental; sem cursor, o completo. É como
    // o Entra se comporta, e é o que permite exercitar a queda para leitura
    // completa quando o cursor expira.
    const roteiro = opcoes.cursor ? (this.config.paginasIncrementais ?? []) : this.config.paginas;

    if (opcoes.cursor && this.config.cursorExpirado) {
      throw new CursorExpiradoError('Cursor simulado como expirado');
    }

    for (const [indice, pagina] of roteiro.entries()) {
      if (this.config.falharNaPagina === indice) {
        throw new Error('Falha simulada de leitura do diretório');
      }

      const ultima = indice === roteiro.length - 1;
      yield { pessoas: pagina, cursor: ultima ? (this.config.cursorFinal ?? null) : null };
    }
  }
}

/// Monta uma pessoa canônica com o mínimo, para o teste declarar só o que
/// importa ao caso que está exercitando.
export function pessoaFalsa(parcial: Partial<PessoaDiretorio> & { externalId: string }): PessoaDiretorio {
  return {
    nomeExibicao: `Pessoa ${parcial.externalId}`,
    primeiroNome: null,
    sobrenome: null,
    email: null,
    loginPrincipal: null,
    cargo: null,
    departamento: null,
    empresa: null,
    escritorio: null,
    telefone: null,
    celular: null,
    pais: null,
    cidade: null,
    estado: null,
    idioma: null,
    fusoHorario: null,
    contaHabilitada: true,
    gestorExternalId: null,
    removido: false,
    bruto: null,
    ...parcial,
  };
}
