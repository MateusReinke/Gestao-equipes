import { describe, expect, it } from 'vitest';
import {
  addMonths,
  calcularCiclos,
  cicloDeUmaData,
  diasCorridos,
  diasDireitoPorFaltas,
  maximoAbono,
  validarFracionamento,
  validarPedidoFerias,
} from '../vacation-cycle.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (data: Date) => data.toISOString().slice(0, 10);

describe('addMonths', () => {
  it('preserva o dia do mês', () => {
    expect(iso(addMonths(d('2024-03-15'), 12))).toBe('2025-03-15');
  });

  it('admissão em 31 de janeiro fecha em fevereiro, não transborda para março', () => {
    expect(iso(addMonths(d('2024-01-31'), 1))).toBe('2024-02-29'); // 2024 é bissexto
    expect(iso(addMonths(d('2025-01-31'), 1))).toBe('2025-02-28');
  });

  it('29 de fevereiro de ano bissexto cai em 28 no ano seguinte', () => {
    expect(iso(addMonths(d('2024-02-29'), 12))).toBe('2025-02-28');
  });

  it('atravessa a virada de ano', () => {
    expect(iso(addMonths(d('2024-11-20'), 24))).toBe('2026-11-20');
  });
});

describe('dias de direito por faltas (Art. 130)', () => {
  it('aplica a tabela da CLT nas faixas e nas bordas', () => {
    expect(diasDireitoPorFaltas(0)).toBe(30);
    expect(diasDireitoPorFaltas(5)).toBe(30);
    expect(diasDireitoPorFaltas(6)).toBe(24);
    expect(diasDireitoPorFaltas(14)).toBe(24);
    expect(diasDireitoPorFaltas(15)).toBe(18);
    expect(diasDireitoPorFaltas(23)).toBe(18);
    expect(diasDireitoPorFaltas(24)).toBe(12);
    expect(diasDireitoPorFaltas(32)).toBe(12);
  });

  it('acima de 32 faltas o direito é perdido por completo', () => {
    expect(diasDireitoPorFaltas(33)).toBe(0);
    expect(diasDireitoPorFaltas(100)).toBe(0);
  });
});

describe('abono pecuniário (Art. 143)', () => {
  it('é limitado a um terço do direito', () => {
    expect(maximoAbono(30)).toBe(10);
    expect(maximoAbono(24)).toBe(8);
    expect(maximoAbono(18)).toBe(6);
    expect(maximoAbono(12)).toBe(4);
    expect(maximoAbono(0)).toBe(0);
  });
});

describe('dias corridos', () => {
  it('conta as duas pontas — 1º a 30 são 30 dias, não 29', () => {
    expect(diasCorridos(d('2026-01-01'), d('2026-01-30'))).toBe(30);
    expect(diasCorridos(d('2026-01-01'), d('2026-01-01'))).toBe(1);
  });
});

describe('montagem dos ciclos', () => {
  const admissao = d('2024-03-15');

  it('não existe ciclo antes da admissão', () => {
    expect(calcularCiclos({ dataAdmissao: admissao, hoje: d('2024-03-14') })).toEqual([]);
  });

  it('o primeiro ciclo nasce no dia da admissão', () => {
    const [ciclo] = calcularCiclos({ dataAdmissao: admissao, hoje: d('2024-03-15') });

    expect(iso(ciclo.inicio)).toBe('2024-03-15');
    expect(iso(ciclo.fim)).toBe('2025-03-14');
    expect(iso(ciclo.limiteConcessivo)).toBe('2026-03-14');
    expect(ciclo.status).toBe('em_curso');
    // Enquanto o aquisitivo corre, não há prazo de concessão a acompanhar.
    expect(ciclo.diasParaLimite).toBeNull();
  });

  it('ao fechar o aquisitivo o direito fica disponível e o prazo passa a contar', () => {
    const [ciclo] = calcularCiclos({ dataAdmissao: admissao, hoje: d('2025-03-15') });

    expect(ciclo.status).toBe('disponivel');
    expect(ciclo.diasSaldo).toBe(30);
    expect(ciclo.diasParaLimite).toBe(364);
  });

  it('o concessivo de um ciclo corre em paralelo ao aquisitivo do seguinte', () => {
    const ciclos = calcularCiclos({ dataAdmissao: admissao, hoje: d('2025-06-01') });

    expect(ciclos).toHaveLength(2);
    expect(ciclos[0].status).toBe('disponivel');
    expect(ciclos[1].status).toBe('em_curso');
    // O aquisitivo do ciclo 2 começa onde o do 1 terminou.
    expect(iso(ciclos[1].inicio)).toBe('2025-03-15');
  });

  it('passado o limite com saldo, o ciclo está vencido — é o risco de pagamento em dobro', () => {
    const [ciclo] = calcularCiclos({ dataAdmissao: admissao, hoje: d('2026-03-15') });

    expect(ciclo.status).toBe('vencido');
    expect(ciclo.diasSaldo).toBe(30);
    expect(ciclo.diasParaLimite).toBe(-1);
  });

  it('faltas injustificadas do próprio ciclo reduzem o direito; as de outro ciclo não', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      hoje: d('2025-06-01'),
      faltas: [
        // 6 faltas dentro do ciclo 1 -> 24 dias
        ...['2024-04-01', '2024-05-02', '2024-06-03', '2024-07-04', '2024-08-05', '2024-09-06'].map(d),
        // 1 falta já no ciclo 2, não pode afetar o ciclo 1
        d('2025-04-10'),
      ],
    });

    expect(ciclos[0].faltasInjustificadas).toBe(6);
    expect(ciclos[0].diasDireito).toBe(24);
    expect(ciclos[1].faltasInjustificadas).toBe(1);
    expect(ciclos[1].diasDireito).toBe(30);
  });

  it('férias gozadas abatem do saldo do ciclo que consumiram', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      hoje: d('2025-08-01'),
      feriasGozadas: [{ cicloNumero: 1, dataInicio: d('2025-06-01'), dataFim: d('2025-06-20'), diasAbono: 0 }],
    });

    expect(ciclos[0].diasGozados).toBe(20);
    expect(ciclos[0].diasSaldo).toBe(10);
    expect(ciclos[0].status).toBe('parcialmente_gozado');
    // O ciclo 2 continua intocado.
    expect(ciclos[1].diasSaldo).toBe(30);
  });

  it('o abono consome saldo junto com os dias gozados', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      hoje: d('2025-08-01'),
      feriasGozadas: [{ cicloNumero: 1, dataInicio: d('2025-06-01'), dataFim: d('2025-06-20'), diasAbono: 10 }],
    });

    expect(ciclos[0].diasSaldo).toBe(0);
    expect(ciclos[0].status).toBe('concluido');
  });

  it('ajuste manual soma ou subtrai do direito', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      hoje: d('2025-08-01'),
      ajustes: [{ cicloNumero: 1, diasDelta: -5, motivo: 'Acordo coletivo' }],
    });

    expect(ciclos[0].diasAjuste).toBe(-5);
    expect(ciclos[0].diasSaldo).toBe(25);
  });

  it('saldo nunca fica negativo, mesmo com gozo acima do direito', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      hoje: d('2025-08-01'),
      feriasGozadas: [{ cicloNumero: 1, dataInicio: d('2025-05-01'), dataFim: d('2025-07-01'), diasAbono: 0 }],
    });

    expect(ciclos[0].diasSaldo).toBe(0);
  });

  it('depois do desligamento nenhum ciclo novo se abre', () => {
    const ciclos = calcularCiclos({
      dataAdmissao: admissao,
      dataDesligamento: d('2025-04-30'),
      hoje: d('2027-01-01'),
    });

    // Ciclo 1 completo e o 2 iniciado antes da saída; nada além disso.
    expect(ciclos).toHaveLength(2);
  });

  it('admissão no fim do mês mantém a virada coerente ao longo dos anos', () => {
    const ciclos = calcularCiclos({ dataAdmissao: d('2024-01-31'), hoje: d('2026-02-01') });

    expect(iso(ciclos[0].inicio)).toBe('2024-01-31');
    expect(iso(ciclos[0].fim)).toBe('2025-01-30');
    expect(iso(ciclos[1].inicio)).toBe('2025-01-31');
  });
});

describe('classificação de férias antigas', () => {
  it('associa a data ao ciclo cujo concessivo a contém', () => {
    const ciclos = calcularCiclos({ dataAdmissao: d('2024-03-15'), hoje: d('2026-06-01') });

    // Junho/2025 cai no concessivo do ciclo 1 (15/03/2025 a 14/03/2026).
    expect(cicloDeUmaData(ciclos, d('2025-06-10'))).toBe(1);
    // Junho/2026 já está no concessivo do ciclo 2.
    expect(cicloDeUmaData(ciclos, d('2026-06-10'))).toBe(2);
  });

  it('data anterior a qualquer concessivo não pertence a ciclo nenhum', () => {
    const ciclos = calcularCiclos({ dataAdmissao: d('2024-03-15'), hoje: d('2026-06-01') });
    expect(cicloDeUmaData(ciclos, d('2024-06-10'))).toBeNull();
  });
});

describe('fracionamento (Art. 134 §1)', () => {
  const periodo = (inicio: string, fim: string) => ({ dataInicio: d(inicio), dataFim: d(fim) });

  it('período único de 30 dias não precisa do mínimo de 14', () => {
    expect(validarFracionamento([periodo('2026-01-01', '2026-01-30')])).toEqual([]);
  });

  it('aceita a divisão clássica de 15 + 10 + 5', () => {
    const problemas = validarFracionamento([
      periodo('2026-01-01', '2026-01-15'),
      periodo('2026-03-01', '2026-03-10'),
      periodo('2026-06-01', '2026-06-05'),
    ]);

    expect(problemas).toEqual([]);
  });

  it('recusa mais de três períodos', () => {
    const problemas = validarFracionamento([
      periodo('2026-01-01', '2026-01-14'),
      periodo('2026-02-01', '2026-02-06'),
      periodo('2026-03-01', '2026-03-05'),
      periodo('2026-04-01', '2026-04-05'),
    ]);

    expect(problemas.map((p) => p.codigo)).toContain('fracionamento_excedido');
    expect(problemas.every((p) => p.bloqueia)).toBe(true);
  });

  it('recusa período com menos de 5 dias', () => {
    const problemas = validarFracionamento([periodo('2026-01-01', '2026-01-20'), periodo('2026-03-01', '2026-03-03')]);

    expect(problemas.map((p) => p.codigo)).toContain('periodo_curto');
  });

  it('ao fracionar, exige que um dos períodos tenha ao menos 14 dias', () => {
    const problemas = validarFracionamento([periodo('2026-01-01', '2026-01-13'), periodo('2026-03-01', '2026-03-13')]);

    expect(problemas.map((p) => p.codigo)).toContain('sem_periodo_de_14');
  });
});

describe('validação de um pedido de férias', () => {
  const [ciclo] = calcularCiclos({ dataAdmissao: d('2024-03-15'), hoje: d('2025-06-01') });
  const base = { ciclo, diasAbono: 0, outrasDoCiclo: [] as Array<{ dataInicio: Date; dataFim: Date }> };

  it('recusa fim antes do início e nem chega a olhar o resto', () => {
    const problemas = validarPedidoFerias({ ...base, dataInicio: d('2025-07-10'), dataFim: d('2025-07-01') });

    expect(problemas).toHaveLength(1);
    expect(problemas[0].codigo).toBe('periodo_invalido');
  });

  it('recusa pedido maior que o saldo', () => {
    const problemas = validarPedidoFerias({ ...base, dataInicio: d('2025-07-01'), dataFim: d('2025-08-15') });

    const saldo = problemas.find((p) => p.codigo === 'saldo_insuficiente');
    expect(saldo?.bloqueia).toBe(true);
    expect(saldo?.mensagem).toContain('30 dia(s) de saldo');
  });

  it('recusa abono acima de um terço', () => {
    const problemas = validarPedidoFerias({
      ...base,
      dataInicio: d('2025-07-01'),
      dataFim: d('2025-07-15'),
      diasAbono: 11,
    });

    expect(problemas.map((p) => p.codigo)).toContain('abono_excedido');
  });

  it('aceita abono de exatamente um terço', () => {
    const problemas = validarPedidoFerias({
      ...base,
      dataInicio: d('2025-07-01'),
      dataFim: d('2025-07-20'),
      diasAbono: 10,
    });

    expect(problemas.filter((p) => p.bloqueia)).toEqual([]);
  });

  it('recusa sobreposição com férias já registradas', () => {
    const problemas = validarPedidoFerias({
      ...base,
      dataInicio: d('2025-07-10'),
      dataFim: d('2025-07-20'),
      outrasDoCiclo: [{ dataInicio: d('2025-07-15'), dataFim: d('2025-07-25') }],
    });

    expect(problemas.map((p) => p.codigo)).toContain('sobreposicao');
  });

  it('avisa, sem bloquear, quando as férias passam do limite de concessão', () => {
    const problemas = validarPedidoFerias({ ...base, dataInicio: d('2026-03-01'), dataFim: d('2026-03-20') });

    const alem = problemas.find((p) => p.codigo === 'alem_do_concessivo');
    expect(alem?.bloqueia).toBe(false);
  });

  it('avisa sobre o início véspera de repouso semanal, sem bloquear', () => {
    // 2025-07-04 é uma sexta-feira.
    const problemas = validarPedidoFerias({ ...base, dataInicio: d('2025-07-04'), dataFim: d('2025-07-20') });

    const aviso = problemas.find((p) => p.codigo === 'inicio_proximo_ao_repouso');
    expect(aviso?.bloqueia).toBe(false);
  });

  it('pedido normal de 20 dias numa segunda não gera bloqueio', () => {
    // 2025-07-07 é uma segunda-feira.
    const problemas = validarPedidoFerias({ ...base, dataInicio: d('2025-07-07'), dataFim: d('2025-07-26') });

    expect(problemas.filter((p) => p.bloqueia)).toEqual([]);
  });
});
