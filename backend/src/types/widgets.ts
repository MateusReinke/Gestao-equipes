import { z } from 'zod';

/**
 * Catálogo de widgets que um dashboard pode conter.
 * O layout salvo em `dashboard_versoes.layout` é apenas a *declaração* — cada
 * widget diz o que quer ver, e o backend resolve os dados no momento da leitura.
 * Nada de dado operacional é congelado dentro da versão: assim uma versão antiga
 * restaurada continua mostrando números de hoje, não os de quando foi salva.
 */
export const WIDGET_TYPES = [
  'metrica',
  'em_turno_agora',
  'proximos_turnos',
  'trocas_pendentes',
  'ausencias_periodo',
  'cobertura_semana',
  'carga_por_colaborador',
  'clientes_sla',
  'nota',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/// Métricas disponíveis para o widget de contador.
export const METRIC_KEYS = [
  'clientes',
  'equipes',
  'colaboradores',
  'em_turno_agora',
  'ferias_hoje',
  'trocas_pendentes',
  'escalas_ativas',
  'turnos_7_dias',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

const widgetOptionsSchema = z
  .object({
    /** widget `metrica`: qual contador exibir */
    metrica: z.enum(METRIC_KEYS).optional(),
    /** quantos itens listar (widgets de lista) */
    limite: z.coerce.number().int().min(1).max(50).optional(),
    /** janela em dias (widgets de período) */
    dias: z.coerce.number().int().min(1).max(90).optional(),
    /** widget `nota`: texto livre exibido no painel */
    texto: z.string().max(2000).optional(),
    /** filtra por equipe; ausente = todas as equipes visíveis */
    equipeId: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict()
  .default({});

export const widgetSchema = z.object({
  id: z.string().min(1).max(64),
  tipo: z.enum(WIDGET_TYPES),
  titulo: z.string().trim().min(1).max(80),
  /** largura em colunas de uma grade de 4 */
  largura: z.coerce.number().int().min(1).max(4).default(2),
  opcoes: widgetOptionsSchema,
});

export const layoutSchema = z.object({
  widgets: z.array(widgetSchema).max(24),
});

export type Widget = z.infer<typeof widgetSchema>;
export type DashboardLayout = z.infer<typeof layoutSchema>;

export const EMPTY_LAYOUT: DashboardLayout = { widgets: [] };

/// Metadados de apresentação usados pelo frontend para montar o seletor de widgets.
export const WIDGET_CATALOG: Array<{
  tipo: WidgetType;
  nome: string;
  descricao: string;
  larguraPadrao: number;
}> = [
  { tipo: 'metrica', nome: 'Contador', descricao: 'Um número em destaque — clientes, equipes, turnos, férias...', larguraPadrao: 1 },
  { tipo: 'em_turno_agora', nome: 'Em turno agora', descricao: 'Quem está cobrindo a operação neste momento', larguraPadrao: 2 },
  { tipo: 'proximos_turnos', nome: 'Próximos turnos', descricao: 'O que vem a seguir no calendário', larguraPadrao: 2 },
  { tipo: 'trocas_pendentes', nome: 'Trocas pendentes', descricao: 'Pedidos aguardando aceite ou aprovação', larguraPadrao: 2 },
  { tipo: 'ausencias_periodo', nome: 'Férias e ausências', descricao: 'Quem fica indisponível no período', larguraPadrao: 2 },
  { tipo: 'cobertura_semana', nome: 'Cobertura por dia', descricao: 'Quantidade de turnos em cada dia do período', larguraPadrao: 2 },
  { tipo: 'carga_por_colaborador', nome: 'Carga por colaborador', descricao: 'Quantos turnos cada pessoa acumulou no período', larguraPadrao: 2 },
  { tipo: 'clientes_sla', nome: 'Clientes e SLA', descricao: 'Contato de escalation e SLA contratado', larguraPadrao: 2 },
  { tipo: 'nota', nome: 'Nota', descricao: 'Texto livre — procedimento, aviso, link de runbook', larguraPadrao: 2 },
];
