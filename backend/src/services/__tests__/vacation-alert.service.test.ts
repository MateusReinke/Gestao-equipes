import { describe, expect, it } from 'vitest';
import { calcularCiclos } from '../vacation-cycle.service';
import { HORIZONTE_PADRAO, avaliarCiclos, ordenarPorUrgencia } from '../vacation-alert.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/// Admissão em 15/03/2024 → concessivo do ciclo 1 termina em 14/03/2026.
function alertasEm(hoje: string, extras: Parameters<typeof calcularCiclos>[0] = { dataAdmissao: d('2024-03-15') }) {
  const ciclos = calcularCiclos({ ...extras, dataAdmissao: d('2024-03-15'), hoje: d(hoje) });
  return avaliarCiclos({ colaboradorId: 7, colaboradorNome: 'Ana Lima', ciclos });
}

describe('alertas de férias', () => {
  it('ciclo em curso não gera alerta — ainda não há direito', () => {
    expect(alertasEm('2024-09-01')).toEqual([]);
  });

  it('direito recém-adquirido com prazo folgado só informa', () => {
    const alertas = alertasEm('2025-03-20');

    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('ferias_direito_adquirido');
    expect(alertas[0].severidade).toBe('info');
    expect(alertas[0].mensagem).toContain('14/03/2026');
  });

  it('a 120 dias do limite vira aviso de programação', () => {
    // 14/03/2026 menos 120 dias = 14/11/2025.
    const alertas = alertasEm('2025-11-14');

    expect(alertas[0].tipo).toBe('ferias_prazo_proximo');
    expect(alertas[0].severidade).toBe('aviso');
    expect(alertas[0].diasParaLimite).toBe(HORIZONTE_PADRAO.proximo);
  });

  it('um dia antes do horizonte ainda é apenas informativo', () => {
    const alertas = alertasEm('2025-11-13');
    expect(alertas[0].tipo).toBe('ferias_direito_adquirido');
  });

  it('a 45 dias vira crítico', () => {
    // 14/03/2026 menos 45 dias = 28/01/2026.
    const alertas = alertasEm('2026-01-28');

    expect(alertas[0].tipo).toBe('ferias_prazo_critico');
    expect(alertas[0].severidade).toBe('critico');
    expect(alertas[0].diasParaLimite).toBe(HORIZONTE_PADRAO.critico);
  });

  it('passado o limite, avisa o pagamento em dobro', () => {
    const alertas = alertasEm('2026-03-15');
    const vencida = alertas.find((a) => a.tipo === 'ferias_vencida');

    expect(vencida?.severidade).toBe('critico');
    expect(vencida?.mensagem).toContain('Art. 137');
    expect(vencida?.diasParaLimite).toBeLessThan(0);
  });

  it('cada ciclo gera no máximo um alerta, o mais grave', () => {
    const alertas = alertasEm('2026-01-28');
    const doCiclo1 = alertas.filter((a) => a.cicloNumero === 1);

    expect(doCiclo1).toHaveLength(1);
  });

  it('ciclo já quitado não gera alerta', () => {
    const alertas = alertasEm('2026-01-28', {
      dataAdmissao: d('2024-03-15'),
      feriasGozadas: [{ cicloNumero: 1, dataInicio: d('2025-06-01'), dataFim: d('2025-06-30'), diasAbono: 0 }],
    });

    expect(alertas.filter((a) => a.cicloNumero === 1)).toEqual([]);
  });

  it('saldo parcial continua alertando pelo que sobrou', () => {
    const alertas = alertasEm('2026-01-28', {
      dataAdmissao: d('2024-03-15'),
      feriasGozadas: [{ cicloNumero: 1, dataInicio: d('2025-06-01'), dataFim: d('2025-06-20'), diasAbono: 0 }],
    });

    expect(alertas[0].tipo).toBe('ferias_prazo_critico');
    expect(alertas[0].diasSaldo).toBe(10);
    expect(alertas[0].mensagem).toContain('10 dia(s) em aberto');
  });

  it('quem perdeu o direito por faltas não gera alerta de prazo', () => {
    const alertas = alertasEm('2026-01-28', {
      dataAdmissao: d('2024-03-15'),
      // 33 faltas DISTINTAS dentro do ciclo 1 (15/03/2024 a 14/03/2025) zeram
      // o direito (Art. 130). Datas sequenciais a partir de 01/04/2024.
      faltas: Array.from({ length: 33 }, (_, i) => {
        const data = new Date(Date.UTC(2024, 3, 1));
        data.setUTCDate(data.getUTCDate() + i);
        return data;
      }),
    });

    expect(alertas.filter((a) => a.cicloNumero === 1)).toEqual([]);
  });

  it('dois ciclos em aberto geram um alerta cada', () => {
    const alertas = alertasEm('2026-03-20');

    expect(alertas.map((a) => a.cicloNumero).sort()).toEqual([1, 2]);
    expect(alertas.find((a) => a.cicloNumero === 1)?.tipo).toBe('ferias_vencida');
  });
});

describe('chave de idempotência', () => {
  it('identifica o fato, não o instante — reexecutar no dia seguinte repete a chave', () => {
    const hoje = alertasEm('2026-01-28');
    const amanha = alertasEm('2026-01-29');

    expect(hoje[0].chaveIdempotencia).toBe('ferias_prazo_critico:colab=7:ciclo=1');
    expect(amanha[0].chaveIdempotencia).toBe(hoje[0].chaveIdempotencia);
  });

  it('mudar de severidade gera chave nova — o agravamento merece novo aviso', () => {
    const aviso = alertasEm('2025-11-14')[0];
    const critico = alertasEm('2026-01-28')[0];

    expect(aviso.chaveIdempotencia).not.toBe(critico.chaveIdempotencia);
  });

  it('ciclos diferentes não colidem', () => {
    const alertas = alertasEm('2026-03-20');
    const chaves = new Set(alertas.map((a) => a.chaveIdempotencia));

    expect(chaves.size).toBe(alertas.length);
  });
});

describe('ordenação por urgência', () => {
  it('crítico antes de aviso, e dentro da mesma severidade o prazo mais curto primeiro', () => {
    const ordenados = ordenarPorUrgencia([
      { severidade: 'aviso', diasParaLimite: 100 },
      { severidade: 'critico', diasParaLimite: 40 },
      { severidade: 'info', diasParaLimite: 300 },
      { severidade: 'critico', diasParaLimite: -10 },
    ]);

    expect(ordenados.map((a) => a.diasParaLimite)).toEqual([-10, 40, 100, 300]);
  });
});
