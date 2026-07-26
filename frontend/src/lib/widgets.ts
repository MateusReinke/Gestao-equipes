/// Espelho do catálogo de widgets do backend (`backend/src/types/widgets.ts`).
/// Fica aqui para o builder montar o seletor sem depender de uma chamada extra.

export type WidgetType =
  | 'metrica'
  | 'em_turno_agora'
  | 'proximos_turnos'
  | 'trocas_pendentes'
  | 'ausencias_periodo'
  | 'cobertura_semana'
  | 'carga_por_colaborador'
  | 'clientes_sla'
  | 'nota';

export type MetricKey =
  | 'clientes'
  | 'equipes'
  | 'colaboradores'
  | 'em_turno_agora'
  | 'ferias_hoje'
  | 'trocas_pendentes'
  | 'escalas_ativas'
  | 'turnos_7_dias';

export type WidgetOptions = {
  metrica?: MetricKey;
  limite?: number;
  dias?: number;
  texto?: string;
  equipeId?: number | null;
};

export type Widget = {
  id: string;
  tipo: WidgetType;
  titulo: string;
  largura: number;
  opcoes: WidgetOptions;
};

export type DashboardLayout = { widgets: Widget[] };

/// Resultado já resolvido pelo backend: a declaração do widget + os dados.
export type WidgetResult = Widget & { dados: unknown };

export type WidgetSpec = {
  tipo: WidgetType;
  nome: string;
  descricao: string;
  larguraPadrao: number;
  /** quais opções o formulário do builder deve oferecer para este tipo */
  campos: Array<'metrica' | 'limite' | 'dias' | 'texto' | 'equipe'>;
};

export const WIDGET_SPECS: WidgetSpec[] = [
  {
    tipo: 'metrica',
    nome: 'Contador',
    descricao: 'Um número em destaque — clientes, equipes, turnos, férias...',
    larguraPadrao: 1,
    campos: ['metrica', 'equipe'],
  },
  {
    tipo: 'em_turno_agora',
    nome: 'Em turno agora',
    descricao: 'Quem está cobrindo a operação neste momento',
    larguraPadrao: 2,
    campos: ['limite', 'equipe'],
  },
  {
    tipo: 'proximos_turnos',
    nome: 'Próximos turnos',
    descricao: 'O que vem a seguir no calendário',
    larguraPadrao: 2,
    campos: ['limite', 'equipe'],
  },
  {
    tipo: 'trocas_pendentes',
    nome: 'Trocas pendentes',
    descricao: 'Pedidos aguardando aceite ou aprovação',
    larguraPadrao: 2,
    campos: ['limite', 'equipe'],
  },
  {
    tipo: 'ausencias_periodo',
    nome: 'Férias e ausências',
    descricao: 'Quem fica indisponível no período',
    larguraPadrao: 2,
    campos: ['dias', 'limite', 'equipe'],
  },
  {
    tipo: 'cobertura_semana',
    nome: 'Cobertura por dia',
    descricao: 'Quantidade de turnos em cada dia do período',
    larguraPadrao: 2,
    campos: ['dias', 'equipe'],
  },
  {
    tipo: 'carga_por_colaborador',
    nome: 'Carga por colaborador',
    descricao: 'Quantos turnos e horas cada pessoa acumulou no período',
    larguraPadrao: 2,
    campos: ['dias', 'limite', 'equipe'],
  },
  {
    tipo: 'clientes_sla',
    nome: 'Clientes e SLA',
    descricao: 'Contato de escalation e SLA contratado',
    larguraPadrao: 2,
    campos: ['limite', 'equipe'],
  },
  {
    tipo: 'nota',
    nome: 'Nota',
    descricao: 'Texto livre — procedimento, aviso, link de runbook',
    larguraPadrao: 2,
    campos: ['texto'],
  },
];

export const METRIC_LABELS: Record<MetricKey, string> = {
  clientes: 'Clientes',
  equipes: 'Equipes',
  colaboradores: 'Colaboradores ativos',
  em_turno_agora: 'Em turno agora',
  ferias_hoje: 'Em férias hoje',
  trocas_pendentes: 'Trocas pendentes',
  escalas_ativas: 'Escalas ativas',
  turnos_7_dias: 'Turnos nos próximos 7 dias',
};

export const SHARE_SCOPE_LABELS: Record<string, string> = {
  usuario: 'Pessoa',
  equipe: 'Equipe',
  papel: 'Papel',
  tenant: 'Toda a empresa',
  link_publico: 'Link público',
  plataforma: 'Toda a plataforma',
};

export const SHARE_ACCESS_LABELS: Record<string, string> = {
  leitura: 'Somente leitura',
  edicao: 'Pode editar',
  gestao: 'Pode administrar',
};

export function widgetSpec(tipo: WidgetType): WidgetSpec {
  return WIDGET_SPECS.find((spec) => spec.tipo === tipo) ?? WIDGET_SPECS[0];
}

/// Grade de 4 colunas: a largura do widget é quantas colunas ele ocupa.
export const WIDTH_CLASSES: Record<number, string> = {
  1: 'sm:col-span-2 xl:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-2 xl:col-span-3',
  4: 'sm:col-span-2 xl:col-span-4',
};
