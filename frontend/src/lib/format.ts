const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/// Datas do backend vêm como ISO em UTC (colunas @db.Date à meia-noite).
/// Formatamos sempre em UTC para o dia nunca "andar" pelo fuso do navegador.
export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDateShort(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(date);
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function weekdayName(value: string | Date, curto = false) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const nomes = curto ? DIAS_SEMANA_CURTO : DIAS_SEMANA;
  return nomes[date.getUTCDay()];
}

export function weekdayLabel(diaSemana: number, curto = false) {
  return (curto ? DIAS_SEMANA_CURTO : DIAS_SEMANA)[diaSemana] ?? '-';
}

export function toInputDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string | Date, days: number) {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function formatCnpj(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatCep(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return value;
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

export function formatPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return value;
}

export function formatSla(minutos?: number | null) {
  if (minutos == null) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

export const CONTRATO_LABELS: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  terceirizado: 'Terceirizado',
  estagio: 'Estágio',
};

export const MODELO_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const ESCALA_LABELS: Record<string, string> = {
  doze_por_trinta_seis: '12x36',
  cinco_por_dois: '5x2',
  personalizada: 'Personalizada',
};

export const ESCALA_DESCRICOES: Record<string, string> = {
  doze_por_trinta_seis: 'Revezamento diário: os colaboradores se alternam dia sim, dia não, na ordem definida.',
  cinco_por_dois: 'Escala fixa: todos os colaboradores atribuídos trabalham em todos os dias definidos.',
  personalizada: 'Revezamento por faixa: cada janela de horário do dia vai para o próximo colaborador da rotação.',
};

export const AUSENCIA_LABELS: Record<string, string> = {
  falta: 'Falta',
  atestado: 'Atestado',
  licenca: 'Licença',
  folga: 'Folga',
  banco_horas: 'Banco de horas',
  outro: 'Outro',
};

export const TURNO_TIPO_LABELS: Record<string, string> = {
  turno: 'Turno',
  plantao: 'Plantão',
  sobreaviso: 'Sobreaviso',
};

export const SWAP_STATUS_LABELS: Record<string, string> = {
  pendente: 'Aguardando o colega',
  aceito_pelo_par: 'Aguardando aprovação',
  aprovado: 'Aprovada',
  rejeitado: 'Recusada',
  cancelado: 'Cancelada',
};
