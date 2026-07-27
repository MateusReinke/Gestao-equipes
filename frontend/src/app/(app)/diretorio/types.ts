export type OpcoesDiretorio = {
  sincronizarUsuarios: boolean;
  sincronizarDepartamentos: boolean;
  sincronizarCargos: boolean;
  sincronizarGestores: boolean;
  sincronizarFotos: boolean;
  sincronizarGrupos: boolean;
  sincronizarUsuariosDesabilitados: boolean;
  autoCriarColaboradores: boolean;
  autoDesativarColaboradores: boolean;
  logOperacoes: boolean;
  sincronizacaoCompletaNaPrimeira: boolean;
  intervaloMinutos: number;
  paisPadrao: string;
  fusoHorarioPadrao: string;
  idiomaPadrao: string;
};

export type Conexao = {
  id: number;
  provider: 'entra' | 'google' | 'okta' | 'ldap';
  nome: string;
  ativo: boolean;
  provedorTenantId: string;
  clientId: string;
  authorityUrl: string | null;
  /// Impressão digital do segredo salvo. O segredo em si nunca chega ao
  /// navegador — o que dá para conferir é se é o mesmo de antes.
  segredoImpressao: string | null;
  /// O segredo está no banco mas não abre com a chave atual do ambiente.
  segredoIlegivel: boolean;
  equipePadrao: { id: number; nome: string } | null;
  opcoes: OpcoesDiretorio;
  ultimaSincronizacaoEm: string | null;
  ultimoTesteEm: string | null;
  ultimoTesteOk: boolean | null;
  ultimoErro: string | null;
};

export type Verificacao = {
  recurso: string;
  permissao: string;
  ok: boolean;
  obrigatoria: boolean;
  detalhe: string;
};

export type ResultadoTeste = {
  ok: boolean;
  organizacao: { nome: string; tenantId: string; dominios: string[] } | null;
  verificacoes: Verificacao[];
  erro: string | null;
};

export type Equipe = { id: number; nome: string };

export type PessoaDoEspelho = {
  id: number;
  externalId: string;
  nomeExibicao: string;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  contaHabilitada: boolean;
  removidoEm: string | null;
  ultimaVezEm: string;
  /// Preenchido quando a pessoa já foi vinculada a um colaborador. Na Fase B
  /// ninguém preenche isto — a reconciliação é da Fase D.
  colaboradorId: number | null;
};

export type ItemDeCatalogo = {
  id: number;
  nome: string;
  ativo: boolean;
  pessoas: number;
  ultimaVezEm: string;
};

export type Execucao = {
  id: number;
  modo: 'completa' | 'incremental';
  status: 'executando' | 'sucesso' | 'parcial' | 'erro';
  objetosLidos: number;
  objetosCriados: number;
  objetosAtualizados: number;
  objetosRemovidos: number;
  conflitos: number;
  erro: string | null;
  iniciadoEm: string;
  finalizadoEm: string | null;
  disparadoPor: { id: number; nome: string } | null;
};

export type ResumoDoDiretorio = {
  contadores: { presentes: number; desabilitadas: number; removidas: number; vinculadas: number };
  departamentos: ItemDeCatalogo[];
  cargos: ItemDeCatalogo[];
  execucoes: Execucao[];
};
