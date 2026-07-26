import { describe, expect, it } from 'vitest';
import { generateShifts } from '../shift-generator';
import { formatDateOnly } from '../../utils/date';

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// 2026-03-02 é uma segunda-feira. Usado como âncora nos cenários abaixo.
const SEGUNDA = D('2026-03-02');

function atribuicao(colaboradorId: number, ordem: number, dataInicio = SEGUNDA, dataFim: Date | null = null) {
  return { colaboradorId, ordem, dataInicio, dataFim };
}

describe('generateShifts', () => {
  it('não gera nada sem colaboradores atribuídos', () => {
    const turnos = generateShifts({
      tipo: 'cinco_por_dois',
      detalhes: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }],
      atribuicoes: [],
      inicio: SEGUNDA,
      fim: D('2026-03-06'),
    });
    expect(turnos).toEqual([]);
  });

  it('não gera nada sem faixas de horário definidas', () => {
    const turnos = generateShifts({
      tipo: 'cinco_por_dois',
      detalhes: [],
      atribuicoes: [atribuicao(1, 0)],
      inicio: SEGUNDA,
      fim: D('2026-03-06'),
    });
    expect(turnos).toEqual([]);
  });

  describe('5x2 (escala fixa semanal)', () => {
    it('gera turno para todos os colaboradores em cada dia útil definido', () => {
      const turnos = generateShifts({
        tipo: 'cinco_por_dois',
        detalhes: [
          { diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' },
          { diaSemana: 2, horaInicio: '08:00', horaFim: '17:00' },
        ],
        atribuicoes: [atribuicao(1, 0), atribuicao(2, 1)],
        inicio: SEGUNDA,
        fim: D('2026-03-03'), // segunda + terça
      });

      // 2 dias x 2 colaboradores
      expect(turnos).toHaveLength(4);
      expect(turnos.filter((t) => t.colaboradorId === 1)).toHaveLength(2);
      expect(turnos.filter((t) => t.colaboradorId === 2)).toHaveLength(2);
    });

    it('ignora dias da semana que não estão na escala (fim de semana)', () => {
      const turnos = generateShifts({
        tipo: 'cinco_por_dois',
        detalhes: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }],
        atribuicoes: [atribuicao(1, 0)],
        inicio: SEGUNDA,
        fim: D('2026-03-08'), // uma semana inteira
      });

      expect(turnos).toHaveLength(1);
      expect(formatDateOnly(turnos[0].data)).toBe('2026-03-02');
    });
  });

  describe('12x36 (revezamento diário)', () => {
    it('alterna os dois colaboradores dia a dia', () => {
      const turnos = generateShifts({
        tipo: 'doze_por_trinta_seis',
        detalhes: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ diaSemana: dia, horaInicio: '07:00', horaFim: '19:00' })),
        atribuicoes: [atribuicao(10, 0), atribuicao(20, 1)],
        inicio: SEGUNDA,
        fim: D('2026-03-05'), // 4 dias
      });

      expect(turnos.map((t) => `${formatDateOnly(t.data)}:${t.colaboradorId}`)).toEqual([
        '2026-03-02:10',
        '2026-03-03:20',
        '2026-03-04:10',
        '2026-03-05:20',
      ]);
    });

    it('respeita a ordem definida na atribuição, não a ordem de inserção', () => {
      const turnos = generateShifts({
        tipo: 'doze_por_trinta_seis',
        detalhes: [{ diaSemana: 1, horaInicio: '07:00', horaFim: '19:00' }],
        // colaborador 20 entra primeiro na lista, mas ordem 1
        atribuicoes: [atribuicao(20, 1), atribuicao(10, 0)],
        inicio: SEGUNDA,
        fim: SEGUNDA,
      });

      expect(turnos[0].colaboradorId).toBe(10);
    });

    it('mantém o alinhamento da rotação ao gerar só um pedaço do meio do período', () => {
      const detalhes = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ diaSemana: dia, horaInicio: '07:00', horaFim: '19:00' }));
      const atribuicoes = [atribuicao(10, 0), atribuicao(20, 1)];

      // Gerando o período inteiro, o dia 2026-03-04 é do colaborador 10.
      const completo = generateShifts({ tipo: 'doze_por_trinta_seis', detalhes, atribuicoes, inicio: SEGUNDA, fim: D('2026-03-05') });
      const noCompleto = completo.find((t) => formatDateOnly(t.data) === '2026-03-04');

      // Gerando só aquele dia isolado, tem de dar o mesmo dono.
      const parcial = generateShifts({ tipo: 'doze_por_trinta_seis', detalhes, atribuicoes, inicio: D('2026-03-04'), fim: D('2026-03-04') });

      expect(parcial[0].colaboradorId).toBe(noCompleto!.colaboradorId);
    });

    it('revezamento funciona com três pessoas', () => {
      const turnos = generateShifts({
        tipo: 'doze_por_trinta_seis',
        detalhes: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ diaSemana: dia, horaInicio: '07:00', horaFim: '19:00' })),
        atribuicoes: [atribuicao(1, 0), atribuicao(2, 1), atribuicao(3, 2)],
        inicio: SEGUNDA,
        fim: D('2026-03-07'),
      });

      expect(turnos.map((t) => t.colaboradorId)).toEqual([1, 2, 3, 1, 2, 3]);
    });
  });

  describe('personalizada (revezamento por faixa de horário)', () => {
    it('distribui faixas sobrepostas do mesmo dia entre pessoas diferentes', () => {
      const turnos = generateShifts({
        tipo: 'personalizada',
        detalhes: [
          { diaSemana: 1, horaInicio: '06:00', horaFim: '14:00' },
          { diaSemana: 1, horaInicio: '14:00', horaFim: '22:00' },
        ],
        atribuicoes: [atribuicao(1, 0), atribuicao(2, 1)],
        inicio: SEGUNDA,
        fim: SEGUNDA,
      });

      expect(turnos).toHaveLength(2);
      expect(turnos[0].colaboradorId).not.toBe(turnos[1].colaboradorId);
    });
  });

  describe('vigência das atribuições', () => {
    it('não escala quem ainda não começou na escala', () => {
      const turnos = generateShifts({
        tipo: 'cinco_por_dois',
        detalhes: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }],
        atribuicoes: [atribuicao(1, 0, D('2026-03-09'))], // começa na semana seguinte
        inicio: SEGUNDA,
        fim: SEGUNDA,
      });

      expect(turnos).toEqual([]);
    });

    it('não escala quem já saiu da escala', () => {
      const turnos = generateShifts({
        tipo: 'cinco_por_dois',
        detalhes: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }],
        atribuicoes: [atribuicao(1, 0, D('2026-02-01'), D('2026-02-28'))],
        inicio: SEGUNDA,
        fim: SEGUNDA,
      });

      expect(turnos).toEqual([]);
    });

    it('escala apenas quem está vigente naquele dia', () => {
      const turnos = generateShifts({
        tipo: 'cinco_por_dois',
        detalhes: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }],
        atribuicoes: [
          atribuicao(1, 0, D('2026-02-01'), D('2026-02-28')), // já saiu
          atribuicao(2, 1, SEGUNDA), // ativo
        ],
        inicio: SEGUNDA,
        fim: SEGUNDA,
      });

      expect(turnos).toHaveLength(1);
      expect(turnos[0].colaboradorId).toBe(2);
    });
  });

  it('preserva os horários definidos na escala', () => {
    const turnos = generateShifts({
      tipo: 'cinco_por_dois',
      detalhes: [{ diaSemana: 1, horaInicio: '19:00', horaFim: '07:00' }],
      atribuicoes: [atribuicao(1, 0)],
      inicio: SEGUNDA,
      fim: SEGUNDA,
    });

    expect(turnos[0]).toMatchObject({ horaInicio: '19:00', horaFim: '07:00' });
  });
});
