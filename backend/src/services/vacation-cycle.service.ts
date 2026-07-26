import { addDays, diffInDays, toDateOnly } from '../utils/date';

/**
 * Cálculo do direito a férias segundo a CLT.
 *
 * O ciclo tem DUAS janelas de 12 meses, e confundi-las é o erro comum:
 *
 * - **Período aquisitivo**: 12 meses a partir da admissão. Ao fechar, a pessoa
 *   adquiriu o direito (Art. 130).
 * - **Período concessivo**: os 12 meses SEGUINTES. É o prazo que a empresa tem
 *   para conceder (Art. 134). Estourar esse prazo obriga a pagar em dobro
 *   (Art. 137) — é esse o risco que os alertas protegem.
 *
 * Os ciclos não são armazenados: derivam da data de admissão e são calculados
 * na leitura. Guardar significaria manter sincronizado algo que já é
 * determinístico — e correr o risco de divergir. O que não é derivável (dias
 * vendidos, ajuste manual, quitação em dobro) vive em tabela própria.
 */

/// Tipos de contrato que geram direito a férias com ESTA empresa.
/// PJ não tem vínculo empregatício; o terceirizado tem, mas com a empresa
/// que o contratou — inventar saldo para eles seria erro de cadastro.
export const CONTRATOS_COM_FERIAS = ['clt', 'estagio'] as const;

export type CicloStatus =
  | 'em_curso'
  | 'disponivel'
  | 'parcialmente_gozado'
  | 'concluido'
  | 'vencido';

export type FeriasGozadas = {
  cicloNumero: number | null;
  dataInicio: Date;
  dataFim: Date;
  diasAbono: number;
};

export type AjusteCiclo = {
  cicloNumero: number;
  diasDelta: number;
  motivo: string;
};

export type Ciclo = {
  numero: number;
  /** início do período aquisitivo */
  inicio: Date;
  /** fim do período aquisitivo — a partir daqui o direito está adquirido */
  fim: Date;
  /** último dia para conceder sem incorrer em pagamento em dobro */
  limiteConcessivo: Date;
  diasDireito: number;
  /** faltas injustificadas dentro do período aquisitivo */
  faltasInjustificadas: number;
  diasGozados: number;
  diasAbono: number;
  diasAjuste: number;
  diasSaldo: number;
  status: CicloStatus;
  /** negativo quando o prazo já passou; null enquanto o aquisitivo não fecha */
  diasParaLimite: number | null;
};

/// Soma meses preservando o dia. Em mês curto, cai no último dia — a admissão
/// em 31/01 fecha o aquisitivo em 28/02 (ou 29 em ano bissexto), não em 03/03.
export function addMonths(date: Date, months: number): Date {
  const base = toDateOnly(date);
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + months;
  const dia = base.getUTCDate();

  const tentativa = new Date(Date.UTC(ano, mes, dia));
  // Se o dia transbordou (31 de abril vira 1 de maio), volta para o último dia do mês.
  if (tentativa.getUTCMonth() !== ((mes % 12) + 12) % 12) {
    return new Date(Date.UTC(ano, mes + 1, 0));
  }
  return tentativa;
}

/**
 * Dias de férias conforme faltas injustificadas no período aquisitivo (Art. 130).
 * Acima de 32 faltas o direito é perdido por completo.
 */
export function diasDireitoPorFaltas(faltas: number): number {
  if (faltas <= 5) return 30;
  if (faltas <= 14) return 24;
  if (faltas <= 23) return 18;
  if (faltas <= 32) return 12;
  return 0;
}

/// Teto do abono pecuniário: um terço do direito (Art. 143).
export function maximoAbono(diasDireito: number): number {
  return Math.floor(diasDireito / 3);
}

/// Dias corridos entre duas datas, contando as duas pontas.
export function diasCorridos(inicio: Date, fim: Date): number {
  return diffInDays(inicio, fim) + 1;
}

function intervalosSobrepoem(aInicio: Date, aFim: Date, bInicio: Date, bFim: Date) {
  return toDateOnly(aInicio) <= toDateOnly(bFim) && toDateOnly(bInicio) <= toDateOnly(aFim);
}

/**
 * Quantos ciclos aquisitivos já COMEÇARAM até a data de referência.
 * Um ciclo que ainda não começou não interessa a ninguém.
 */
function ciclosIniciados(dataAdmissao: Date, ate: Date): number {
  const admissao = toDateOnly(dataAdmissao);
  const referencia = toDateOnly(ate);
  if (referencia < admissao) return 0;

  let numero = 0;
  // Cresce um ciclo por vez em vez de dividir por 365: meses têm tamanhos
  // diferentes e a divisão erraria a virada em admissões de fim de mês.
  while (addMonths(admissao, numero * 12) <= referencia) {
    numero += 1;
    if (numero > 200) break; // guarda contra data de admissão absurda
  }
  return numero;
}

export function calcularCiclos(params: {
  dataAdmissao: Date;
  dataDesligamento?: Date | null;
  /** datas de faltas injustificadas já aprovadas */
  faltas?: Date[];
  feriasGozadas?: FeriasGozadas[];
  ajustes?: AjusteCiclo[];
  hoje?: Date;
}): Ciclo[] {
  const hoje = toDateOnly(params.hoje ?? new Date());
  const admissao = toDateOnly(params.dataAdmissao);
  const fimVinculo = params.dataDesligamento ? toDateOnly(params.dataDesligamento) : null;

  // Depois do desligamento nenhum ciclo novo se inicia.
  const referencia = fimVinculo && fimVinculo < hoje ? fimVinculo : hoje;
  const total = ciclosIniciados(admissao, referencia);
  if (total === 0) return [];

  const faltas = params.faltas ?? [];
  const feriasGozadas = params.feriasGozadas ?? [];
  const ajustes = params.ajustes ?? [];

  const ciclos: Ciclo[] = [];

  for (let numero = 1; numero <= total; numero += 1) {
    const inicio = addMonths(admissao, (numero - 1) * 12);
    const fim = addDays(addMonths(inicio, 12), -1);
    const limiteConcessivo = addDays(addMonths(inicio, 24), -1);

    const faltasNoCiclo = faltas.filter((data) => {
      const dia = toDateOnly(data);
      return dia >= inicio && dia <= fim;
    }).length;

    const aquisitivoFechado = hoje > fim;
    // Enquanto o aquisitivo corre, o direito ainda não está consolidado: as
    // faltas que vierem até o fim do período ainda podem reduzi-lo. Mostramos
    // a projeção com o que se sabe hoje.
    const diasDireito = diasDireitoPorFaltas(faltasNoCiclo);

    const doCiclo = feriasGozadas.filter((item) => item.cicloNumero === numero);
    const diasGozados = doCiclo.reduce(
      (soma, item) => soma + diasCorridos(item.dataInicio, item.dataFim),
      0
    );
    const diasAbono = doCiclo.reduce((soma, item) => soma + item.diasAbono, 0);
    const diasAjuste = ajustes
      .filter((item) => item.cicloNumero === numero)
      .reduce((soma, item) => soma + item.diasDelta, 0);

    const diasSaldo = Math.max(0, diasDireito + diasAjuste - diasGozados - diasAbono);

    let status: CicloStatus;
    if (!aquisitivoFechado) status = 'em_curso';
    else if (diasSaldo === 0) status = 'concluido';
    else if (hoje > limiteConcessivo) status = 'vencido';
    else if (diasGozados + diasAbono > 0) status = 'parcialmente_gozado';
    else status = 'disponivel';

    ciclos.push({
      numero,
      inicio,
      fim,
      limiteConcessivo,
      diasDireito,
      faltasInjustificadas: faltasNoCiclo,
      diasGozados,
      diasAbono,
      diasAjuste,
      diasSaldo,
      status,
      diasParaLimite: aquisitivoFechado ? diffInDays(hoje, limiteConcessivo) : null,
    });
  }

  return ciclos;
}

/// A qual ciclo um período de férias pertence: o aquisitivo que estava aberto
/// para concessão quando as férias começaram. Serve para classificar registros
/// antigos, criados antes de o ciclo passar a ser informado.
export function cicloDeUmaData(ciclos: Ciclo[], data: Date): number | null {
  const dia = toDateOnly(data);
  // O concessivo do ciclo N vai do fim do aquisitivo até o limite.
  const candidato = ciclos.find((ciclo) => dia > ciclo.fim && dia <= ciclo.limiteConcessivo);
  return candidato?.numero ?? null;
}

/* ------------------------------------------------------------- validações */

export type ProblemaFerias = { codigo: string; mensagem: string; bloqueia: boolean };

/**
 * Regras de fracionamento (Art. 134 §1, redação da Lei 13.467/2017):
 * até 3 períodos, um deles com no mínimo 14 dias corridos e os demais com
 * pelo menos 5 dias cada.
 *
 * `periodos` deve conter TODAS as férias do ciclo, inclusive a que está
 * sendo solicitada — a regra é sobre o conjunto, não sobre cada pedido.
 */
export function validarFracionamento(periodos: Array<{ dataInicio: Date; dataFim: Date }>): ProblemaFerias[] {
  const problemas: ProblemaFerias[] = [];
  if (periodos.length === 0) return problemas;

  const duracoes = periodos.map((p) => diasCorridos(p.dataInicio, p.dataFim));

  if (periodos.length > 3) {
    problemas.push({
      codigo: 'fracionamento_excedido',
      mensagem: `As férias de um ciclo podem ser divididas em no máximo 3 períodos; este seria o ${periodos.length}º.`,
      bloqueia: true,
    });
  }

  const curtos = duracoes.filter((dias) => dias < 5);
  if (curtos.length > 0) {
    problemas.push({
      codigo: 'periodo_curto',
      mensagem: 'Nenhum período de férias pode ter menos de 5 dias corridos.',
      bloqueia: true,
    });
  }

  // A exigência do período de 14 dias só faz sentido quando há fracionamento.
  if (periodos.length > 1 && !duracoes.some((dias) => dias >= 14)) {
    problemas.push({
      codigo: 'sem_periodo_de_14',
      mensagem: 'Ao fracionar, um dos períodos precisa ter no mínimo 14 dias corridos.',
      bloqueia: true,
    });
  }

  return problemas;
}

/**
 * Art. 134 §3: as férias não podem começar nos 2 dias que antecedem feriado
 * ou dia de repouso semanal.
 *
 * Sem calendário de feriados cadastrado, só dá para conferir o repouso
 * semanal (domingo). Por isso o retorno é AVISO, não bloqueio: bloquear com
 * meia regra daria falsa sensação de conformidade.
 */
export function avisarInicioProximoAoRepouso(dataInicio: Date): ProblemaFerias[] {
  const dia = toDateOnly(dataInicio).getUTCDay();
  // Sexta (5) e sábado (6) antecedem o domingo em até 2 dias.
  if (dia === 5 || dia === 6) {
    return [
      {
        codigo: 'inicio_proximo_ao_repouso',
        mensagem:
          'As férias não devem começar nos 2 dias que antecedem o repouso semanal ou um feriado (Art. 134 §3). Confira também o calendário de feriados.',
        bloqueia: false,
      },
    ];
  }
  return [
    {
      codigo: 'conferir_feriado',
      mensagem: 'Confira se o início não cai nos 2 dias anteriores a um feriado (Art. 134 §3).',
      bloqueia: false,
    },
  ];
}

/**
 * Valida um pedido de férias contra o ciclo escolhido.
 * Devolve os problemas encontrados; quem chama decide o que fazer com os que
 * não bloqueiam (normalmente, mostrar como aviso).
 */
export function validarPedidoFerias(params: {
  ciclo: Ciclo;
  dataInicio: Date;
  dataFim: Date;
  diasAbono: number;
  /** férias já aprovadas do mesmo ciclo, para checar o conjunto */
  outrasDoCiclo: Array<{ dataInicio: Date; dataFim: Date }>;
}): ProblemaFerias[] {
  const problemas: ProblemaFerias[] = [];
  const { ciclo } = params;
  const inicio = toDateOnly(params.dataInicio);
  const fim = toDateOnly(params.dataFim);

  if (fim < inicio) {
    return [{ codigo: 'periodo_invalido', mensagem: 'A data de fim não pode ser anterior à de início.', bloqueia: true }];
  }

  const dias = diasCorridos(inicio, fim);

  if (ciclo.status === 'em_curso') {
    problemas.push({
      codigo: 'aquisitivo_aberto',
      mensagem: `O período aquisitivo deste ciclo só fecha em ${fim.toISOString().slice(0, 10)}. Conceder férias antes disso é adiantamento e precisa de decisão da gestão.`,
      bloqueia: false,
    });
  }

  if (dias + params.diasAbono > ciclo.diasSaldo) {
    problemas.push({
      codigo: 'saldo_insuficiente',
      mensagem: `O ciclo ${ciclo.numero} tem ${ciclo.diasSaldo} dia(s) de saldo, e o pedido consome ${dias + params.diasAbono}.`,
      bloqueia: true,
    });
  }

  const teto = maximoAbono(ciclo.diasDireito);
  if (params.diasAbono > teto) {
    problemas.push({
      codigo: 'abono_excedido',
      mensagem: `O abono pecuniário é limitado a um terço do direito — no máximo ${teto} dia(s) neste ciclo.`,
      bloqueia: true,
    });
  }

  if (params.outrasDoCiclo.some((outra) => intervalosSobrepoem(inicio, fim, outra.dataInicio, outra.dataFim))) {
    problemas.push({
      codigo: 'sobreposicao',
      mensagem: 'Este período se sobrepõe a outras férias já registradas para o mesmo colaborador.',
      bloqueia: true,
    });
  }

  problemas.push(...validarFracionamento([...params.outrasDoCiclo, { dataInicio: inicio, dataFim: fim }]));

  if (toDateOnly(fim) > ciclo.limiteConcessivo) {
    problemas.push({
      codigo: 'alem_do_concessivo',
      mensagem: `Estas férias terminam depois do limite de concessão (${ciclo.limiteConcessivo.toISOString().slice(0, 10)}), o que caracteriza férias em atraso.`,
      bloqueia: false,
    });
  }

  problemas.push(...avisarInicioProximoAoRepouso(inicio));

  return problemas;
}
