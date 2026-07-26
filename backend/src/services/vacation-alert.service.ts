import { Ciclo } from './vacation-cycle.service';

/**
 * Alertas de férias.
 *
 * O horizonte é generoso de propósito. Numa operação 24×7, avisar 30 dias
 * antes do limite é inútil: não dá tempo de achar cobertura para um mês
 * inteiro de plantão e ainda respeitar o aviso prévio de 30 dias das férias
 * (Art. 135). O padrão avisa a 120 dias, quando ainda cabe planejar.
 */
export const HORIZONTE_PADRAO = {
  /** primeiro aviso: dá para planejar com folga */
  proximo: 120,
  /** já aperta: precisa entrar no planejamento do próximo ciclo de escala */
  critico: 45,
} as const;

export type AlertaFerias = {
  tipo: 'ferias_direito_adquirido' | 'ferias_prazo_proximo' | 'ferias_prazo_critico' | 'ferias_vencida';
  severidade: 'info' | 'aviso' | 'critico';
  cicloNumero: number;
  diasSaldo: number;
  /** negativo quando o prazo já passou */
  diasParaLimite: number;
  limiteConcessivo: Date;
  titulo: string;
  mensagem: string;
  /** identifica o FATO, não o instante — é o que impede aviso repetido */
  chaveIdempotencia: string;
};

function formatar(data: Date) {
  return data.toISOString().slice(0, 10).split('-').reverse().join('/');
}

/**
 * Avalia os ciclos de uma pessoa e devolve o alerta mais grave de cada ciclo.
 *
 * Um ciclo gera no máximo um alerta: quem está a 20 dias do limite não
 * precisa receber também o aviso de 120 dias. A chave de idempotência inclui
 * o tipo, então a passagem de "próximo" para "crítico" gera um aviso novo —
 * que é o comportamento desejado.
 */
export function avaliarCiclos(params: {
  colaboradorId: number;
  colaboradorNome: string;
  ciclos: Ciclo[];
  horizonte?: { proximo: number; critico: number };
}): AlertaFerias[] {
  const horizonte = params.horizonte ?? HORIZONTE_PADRAO;
  const alertas: AlertaFerias[] = [];

  for (const ciclo of params.ciclos) {
    // Ciclo em curso ainda não gerou direito; concluído não precisa de nada.
    if (ciclo.status === 'em_curso' || ciclo.status === 'concluido') continue;
    if (ciclo.diasSaldo === 0) continue;

    const diasParaLimite = ciclo.diasParaLimite ?? 0;
    const chave = (tipo: string) => `${tipo}:colab=${params.colaboradorId}:ciclo=${ciclo.numero}`;
    const comum = {
      cicloNumero: ciclo.numero,
      diasSaldo: ciclo.diasSaldo,
      diasParaLimite,
      limiteConcessivo: ciclo.limiteConcessivo,
    };

    if (ciclo.status === 'vencido') {
      alertas.push({
        ...comum,
        tipo: 'ferias_vencida',
        severidade: 'critico',
        titulo: `Férias vencidas: ${params.colaboradorNome}`,
        mensagem:
          `O período concessivo do ciclo ${ciclo.numero} terminou em ${formatar(ciclo.limiteConcessivo)} ` +
          `com ${ciclo.diasSaldo} dia(s) não gozados. A CLT obriga a pagar esse período em dobro (Art. 137).`,
        chaveIdempotencia: chave('ferias_vencida'),
      });
      continue;
    }

    if (diasParaLimite <= horizonte.critico) {
      alertas.push({
        ...comum,
        tipo: 'ferias_prazo_critico',
        severidade: 'critico',
        titulo: `Prazo crítico de férias: ${params.colaboradorNome}`,
        mensagem:
          `Faltam ${diasParaLimite} dia(s) para o limite de concessão do ciclo ${ciclo.numero} ` +
          `(${formatar(ciclo.limiteConcessivo)}), com ${ciclo.diasSaldo} dia(s) em aberto. ` +
          `Passado o prazo, o período é pago em dobro.`,
        chaveIdempotencia: chave('ferias_prazo_critico'),
      });
      continue;
    }

    if (diasParaLimite <= horizonte.proximo) {
      alertas.push({
        ...comum,
        tipo: 'ferias_prazo_proximo',
        severidade: 'aviso',
        titulo: `Programe as férias de ${params.colaboradorNome}`,
        mensagem:
          `Restam ${diasParaLimite} dia(s) para o limite de concessão do ciclo ${ciclo.numero} ` +
          `(${formatar(ciclo.limiteConcessivo)}), com ${ciclo.diasSaldo} dia(s) em aberto. ` +
          `Ainda há tempo de encaixar na escala.`,
        chaveIdempotencia: chave('ferias_prazo_proximo'),
      });
      continue;
    }

    // Direito adquirido e prazo confortável: informa uma vez só, para o
    // gestor saber que já pode programar.
    if (ciclo.status === 'disponivel') {
      alertas.push({
        ...comum,
        tipo: 'ferias_direito_adquirido',
        severidade: 'info',
        titulo: `${params.colaboradorNome} já pode tirar férias`,
        mensagem:
          `O período aquisitivo do ciclo ${ciclo.numero} fechou com ${ciclo.diasSaldo} dia(s) de direito. ` +
          `O prazo para conceder vai até ${formatar(ciclo.limiteConcessivo)}.`,
        chaveIdempotencia: chave('ferias_direito_adquirido'),
      });
    }
  }

  return alertas;
}

/// Ordem de exibição: o que dói mais primeiro, e dentro da mesma severidade,
/// o prazo mais curto.
export function ordenarPorUrgencia<T extends { severidade: string; diasParaLimite: number }>(alertas: T[]): T[] {
  const peso: Record<string, number> = { critico: 0, aviso: 1, info: 2 };
  return [...alertas].sort(
    (a, b) => (peso[a.severidade] ?? 9) - (peso[b.severidade] ?? 9) || a.diasParaLimite - b.diasParaLimite
  );
}
