import { ScaleType } from '@prisma/client';
import { diffInDays, eachDay, toDateOnly } from '../utils/date';

export type GeneratorScaleDetail = { diaSemana: number; horaInicio: string; horaFim: string };
export type GeneratorAssignment = {
  colaboradorId: number;
  ordem: number;
  dataInicio: Date;
  dataFim: Date | null;
};

export type GeneratedShift = {
  colaboradorId: number;
  data: Date;
  horaInicio: string;
  horaFim: string;
};

/**
 * Traduz uma escala (regra) em turnos concretos dia a dia.
 *
 * Regras por tipo:
 * - `cinco_por_dois`: todos os colaboradores atribuídos trabalham em todas as janelas
 *   definidas para aquele dia da semana (escala fixa, sem revezamento).
 * - `doze_por_trinta_seis`: revezamento diário. O colaborador da vez é decidido por
 *   `(dias desde o início da escala) % nº de colaboradores`, seguindo o campo `ordem`.
 *   É isso que faz duas pessoas se alternarem dia sim, dia não.
 * - `personalizada`: revezamento por janela. Cada faixa de horário do dia vai para o
 *   próximo colaborador da rotação, distribuindo turnos sobrepostos entre pessoas diferentes.
 */
export function generateShifts(params: {
  tipo: ScaleType;
  detalhes: GeneratorScaleDetail[];
  atribuicoes: GeneratorAssignment[];
  inicio: Date;
  fim: Date;
}): GeneratedShift[] {
  const { tipo, detalhes, atribuicoes, inicio, fim } = params;
  if (detalhes.length === 0 || atribuicoes.length === 0) return [];

  const ordenadas = [...atribuicoes].sort((a, b) => a.ordem - b.ordem || a.colaboradorId - b.colaboradorId);
  const turnos: GeneratedShift[] = [];

  // Âncora da rotação: a data de início mais antiga entre as atribuições, para que
  // regerar um período no meio da escala não desalinhe o revezamento já combinado.
  const ancora = ordenadas.reduce(
    (menor, item) => (toDateOnly(item.dataInicio) < menor ? toDateOnly(item.dataInicio) : menor),
    toDateOnly(ordenadas[0].dataInicio)
  );

  let contadorRotacao = 0;

  for (const dia of eachDay(inicio, fim)) {
    const diaSemana = dia.getUTCDay();
    const janelas = detalhes.filter((detalhe) => detalhe.diaSemana === diaSemana);
    if (janelas.length === 0) continue;

    // Só entram colaboradores cuja vigência cobre este dia.
    const vigentes = ordenadas.filter((item) => {
      const comecou = toDateOnly(item.dataInicio).getTime() <= dia.getTime();
      const naoTerminou = item.dataFim == null || toDateOnly(item.dataFim).getTime() >= dia.getTime();
      return comecou && naoTerminou;
    });
    if (vigentes.length === 0) continue;

    for (const janela of janelas) {
      if (tipo === 'cinco_por_dois') {
        for (const atribuicao of vigentes) {
          turnos.push({
            colaboradorId: atribuicao.colaboradorId,
            data: dia,
            horaInicio: janela.horaInicio,
            horaFim: janela.horaFim,
          });
        }
        continue;
      }

      if (tipo === 'doze_por_trinta_seis') {
        const indice = ((diffInDays(ancora, dia) % vigentes.length) + vigentes.length) % vigentes.length;
        const atribuicao = vigentes[indice];
        turnos.push({
          colaboradorId: atribuicao.colaboradorId,
          data: dia,
          horaInicio: janela.horaInicio,
          horaFim: janela.horaFim,
        });
        continue;
      }

      // personalizada
      const atribuicao = vigentes[contadorRotacao % vigentes.length];
      contadorRotacao += 1;
      turnos.push({
        colaboradorId: atribuicao.colaboradorId,
        data: dia,
        horaInicio: janela.horaInicio,
        horaFim: janela.horaFim,
      });
    }
  }

  return turnos;
}
