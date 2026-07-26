/// Normaliza para meia-noite UTC. Todas as colunas @db.Date do schema usam esta convenção,
/// evitando que o fuso do servidor empurre um turno para o dia anterior/seguinte.
export const toDateOnly = (date: string | Date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const diffInDays = (from: Date, to: Date) =>
  Math.round((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86_400_000);

/// Lista de datas (meia-noite UTC) de `inicio` até `fim`, inclusive.
export const eachDay = (inicio: Date, fim: Date) => {
  const dias: Date[] = [];
  let cursor = toDateOnly(inicio);
  const ultimo = toDateOnly(fim);
  while (cursor.getTime() <= ultimo.getTime()) {
    dias.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dias;
};

export const formatDateOnly = (date: Date) => toDateOnly(date).toISOString().slice(0, 10);

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/// Considera turnos que viram a meia-noite (ex.: 19:00 -> 07:00).
export const isTimeBetween = (nowMinutes: number, start: string, end: string) => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes >= startMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
};

export const dayBounds = (date = new Date()) => {
  const start = toDateOnly(date);
  return { start, end: addDays(start, 1) };
};

/// Intervalos [aInicio, aFim] e [bInicio, bFim] se sobrepõem?
export const rangesOverlap = (aInicio: Date, aFim: Date, bInicio: Date, bFim: Date) =>
  toDateOnly(aInicio).getTime() <= toDateOnly(bFim).getTime() &&
  toDateOnly(bInicio).getTime() <= toDateOnly(aFim).getTime();
