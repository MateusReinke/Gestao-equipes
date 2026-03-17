'use client';

import { useMemo, useState } from 'react';

type TipoContratacao = 'CLT 12x36' | 'Horário comercial' | 'Plantão dedicado';
type Equipe = 'NOC/SD' | 'Operacional' | 'Infra';

type Colaborador = {
  id: number;
  nome: string;
  equipe: Equipe;
  funcao: string;
  tipoContratacao: TipoContratacao;
  horarioContratual: string;
  clienteArea: string;
  usaValeTransporte: boolean;
  escalaPadrao: '12x36' | 'Administrativa';
  horariosPorDia: Record<string, string>;
};

type Feriado = {
  id: number;
  data: string;
  nome: string;
  tipo: 'Nacional' | 'Estadual' | 'Municipal' | 'Corporativo';
};

type Aba =
  | 'Cadastro'
  | 'ESCALA DE TRABALHO (NOC E SD)'
  | 'ESCALA DE TRABALHO OPERACIONAL'
  | 'PLANTÃO SUPORTE (INFRA)'
  | 'ESCALA DE VALE TRANSPORTE'
  | 'FERIADOS'
  | 'Configuração'
  | 'Escala padrão';

const statusTurnos = ['T1', 'T2', 'T3', 'T4', 'T5', 'Folga', 'Férias', 'Atestado', 'Ausência'];
const statusPlantao = ['Plantão', 'Vaga disponível', 'Folga', 'Escalado'];
const statusVale = ['Presencial', 'Remoto', 'Folga', 'Férias'];

const abas: Aba[] = [
  'Cadastro',
  'ESCALA DE TRABALHO (NOC E SD)',
  'ESCALA DE TRABALHO OPERACIONAL',
  'PLANTÃO SUPORTE (INFRA)',
  'ESCALA DE VALE TRANSPORTE',
  'FERIADOS',
  'Configuração',
  'Escala padrão',
];

const diasSemanaOrdem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const coresStatus: Record<string, string> = {
  Folga: 'bg-emerald-500/20 text-emerald-200',
  Férias: 'bg-violet-500/20 text-violet-200',
  Atestado: 'bg-amber-500/20 text-amber-100',
  Ausência: 'bg-rose-500/20 text-rose-200',
  Plantão: 'bg-sky-500/20 text-sky-200',
  'Vaga disponível': 'bg-slate-700 text-slate-200',
  Presencial: 'bg-blue-500/20 text-blue-100',
  Remoto: 'bg-indigo-500/20 text-indigo-100',
};

function getDiasNoMes(ano: number, mesIndexadoEmUm: number) {
  const totalDias = new Date(ano, mesIndexadoEmUm, 0).getDate();
  return Array.from({ length: totalDias }, (_, i) => {
    const dia = i + 1;
    const data = new Date(ano, mesIndexadoEmUm - 1, dia);
    return {
      dia,
      dataIso: data.toISOString().slice(0, 10),
      diaSemana: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
      diaSemanaIndex: data.getDay(),
    };
  });
}

function valorEscalaPadrao(colaborador: Colaborador, diaIndexadoEmUm: number, diaSemanaIndex: number) {
  if (colaborador.escalaPadrao === '12x36') {
    return diaIndexadoEmUm % 2 === 0 ? 'Folga' : 'T1';
  }

  if (diaSemanaIndex === 0 || diaSemanaIndex === 6) {
    return 'Folga';
  }

  return 'T2';
}

function escalaKey(colaboradorId: number, dia: number) {
  return `${colaboradorId}-${dia}`;
}

const cadastroInicial: Colaborador[] = [
  {
    id: 1,
    nome: 'Jean Santos',
    equipe: 'Infra',
    funcao: 'Analista de Infraestrutura',
    tipoContratacao: 'Plantão dedicado',
    horarioContratual: '08:00 às 18:00',
    clienteArea: 'Datacenter',
    usaValeTransporte: true,
    escalaPadrao: '12x36',
    horariosPorDia: { seg: '08:00-18:00', ter: '08:00-18:00', qua: '08:00-18:00', qui: '08:00-18:00', sex: '08:00-18:00' },
  },
  {
    id: 2,
    nome: 'Camila Rocha',
    equipe: 'NOC/SD',
    funcao: 'Analista NOC',
    tipoContratacao: 'CLT 12x36',
    horarioContratual: '07:00 às 19:00',
    clienteArea: 'Monitoramento',
    usaValeTransporte: true,
    escalaPadrao: '12x36',
    horariosPorDia: { seg: '07:00-19:00', ter: '07:00-19:00', qua: '07:00-19:00', qui: '07:00-19:00', sex: '07:00-19:00' },
  },
  {
    id: 3,
    nome: 'Bruno Lima',
    equipe: 'Operacional',
    funcao: 'Operador de Turno',
    tipoContratacao: 'CLT 12x36',
    horarioContratual: '19:00 às 07:00',
    clienteArea: 'Operações',
    usaValeTransporte: false,
    escalaPadrao: '12x36',
    horariosPorDia: { seg: '19:00-07:00', ter: '19:00-07:00', qua: '19:00-07:00', qui: '19:00-07:00', sex: '19:00-07:00' },
  },
  {
    id: 4,
    nome: 'Ana Martins',
    equipe: 'NOC/SD',
    funcao: 'Service Desk',
    tipoContratacao: 'Horário comercial',
    horarioContratual: '09:00 às 18:00',
    clienteArea: 'Atendimento',
    usaValeTransporte: true,
    escalaPadrao: 'Administrativa',
    horariosPorDia: { seg: '09:00-18:00', ter: '09:00-18:00', qua: '09:00-18:00', qui: '09:00-18:00', sex: '09:00-18:00' },
  },
];

const feriadosIniciais: Feriado[] = [
  { id: 1, data: '2026-01-01', nome: 'Confraternização Universal', tipo: 'Nacional' },
  { id: 2, data: '2026-01-25', nome: 'Aniversário da Cidade', tipo: 'Municipal' },
];

export function WorkforcePlanner() {
  const hoje = new Date();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('Cadastro');
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(cadastroInicial);
  const [feriados, setFeriados] = useState<Feriado[]>(feriadosIniciais);
  const [escalaNoc, setEscalaNoc] = useState<Record<string, string>>({});
  const [escalaOperacional, setEscalaOperacional] = useState<Record<string, string>>({});
  const [escalaPlantao, setEscalaPlantao] = useState<Record<string, string>>({});
  const [escalaVale, setEscalaVale] = useState<Record<string, string>>({});

  const dias = useMemo(() => getDiasNoMes(ano, mes), [ano, mes]);
  const feriadosNoMes = useMemo(() => new Set(feriados.filter((f) => f.data.startsWith(`${ano}-${String(mes).padStart(2, '0')}`)).map((f) => f.data)), [ano, mes, feriados]);

  const nocSd = colaboradores.filter((c) => c.equipe === 'NOC/SD');
  const operacional = colaboradores.filter((c) => c.equipe === 'Operacional');
  const infra = colaboradores.filter((c) => c.equipe === 'Infra');

  function preencherAutomaticamente(tipo: 'noc' | 'operacional' | 'plantao' | 'vale') {
    const target = tipo === 'noc' ? nocSd : tipo === 'operacional' ? operacional : tipo === 'plantao' ? infra : colaboradores.filter((c) => c.usaValeTransporte);

    const novos: Record<string, string> = {};
    target.forEach((colaborador) => {
      dias.forEach((d) => {
        const key = escalaKey(colaborador.id, d.dia);
        if (tipo === 'plantao') {
          novos[key] = d.dia % 2 === 0 ? 'Vaga disponível' : 'Plantão';
        } else if (tipo === 'vale') {
          novos[key] = d.diaSemanaIndex === 0 || d.diaSemanaIndex === 6 ? 'Folga' : 'Presencial';
        } else {
          novos[key] = valorEscalaPadrao(colaborador, d.dia, d.diaSemanaIndex);
        }
      });
    });

    if (tipo === 'noc') setEscalaNoc(novos);
    if (tipo === 'operacional') setEscalaOperacional(novos);
    if (tipo === 'plantao') setEscalaPlantao(novos);
    if (tipo === 'vale') setEscalaVale(novos);
  }

  function classeCelula(valor: string, dataIso: string) {
    if (feriadosNoMes.has(dataIso)) {
      return 'bg-amber-500/15 text-amber-100';
    }
    return coresStatus[valor] || 'bg-slate-800 text-slate-100';
  }

  function renderTabelaEscala(
    titulo: string,
    lista: Colaborador[],
    estado: Record<string, string>,
    setEstado: (valor: Record<string, string>) => void,
    opcoes: string[],
  ) {
    return (
      <div className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{titulo}</h3>
          <button className="rounded-lg border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800" type="button" onClick={() => preencherAutomaticamente(titulo.includes('NOC') ? 'noc' : titulo.includes('OPERACIONAL') ? 'operacional' : titulo.includes('PLANTÃO') ? 'plantao' : 'vale')}>
            Aplicar padrão do mês
          </button>
        </div>
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left">Nome</th>
              <th className="sticky left-[180px] z-10 bg-slate-900 px-3 py-2 text-left">Tipo</th>
              {dias.map((d) => (
                <th key={d.dia} className="px-2 py-2 text-center">
                  <div>{String(d.dia).padStart(2, '0')}</div>
                  <div className="text-[10px] text-slate-400">{d.diaSemana.replace('.', '')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-b border-slate-800">
                <td className="sticky left-0 bg-slate-900 px-3 py-2">{c.nome}</td>
                <td className="sticky left-[180px] bg-slate-900 px-3 py-2">{c.tipoContratacao}</td>
                {dias.map((d) => {
                  const key = escalaKey(c.id, d.dia);
                  const value = estado[key] || '';
                  return (
                    <td key={key} className="p-1">
                      <select
                        className={`w-24 rounded border border-slate-700 px-1 py-1 text-[11px] ${classeCelula(value, d.dataIso)}`}
                        value={value}
                        onChange={(e) => setEstado({ ...estado, [key]: e.target.value })}
                      >
                        <option value="">-</option>
                        {opcoes.map((opcao) => (
                          <option key={opcao} value={opcao}>
                            {opcao}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-xl font-semibold">Sistema de Gestão de Escalas e Plantões</h2>
        <p className="mt-1 text-sm text-slate-300">Abas interligadas para cadastro, jornadas, plantões, vale transporte, feriados e escalas mensais.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Mês da escala</span>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Math.min(12, Math.max(1, Number(e.target.value))))} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Ano</span>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" type="number" min={2024} max={2100} value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </label>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
            <p className="text-slate-400">Primeiro dia do mês</p>
            <p className="mt-1 font-medium">{dias[0]?.diaSemana}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
            <p className="text-slate-400">Dias no mês</p>
            <p className="mt-1 font-medium">{dias.length}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {abas.map((aba) => (
          <button key={aba} type="button" onClick={() => setAbaAtiva(aba)} className={`rounded-full border px-3 py-1 text-sm ${abaAtiva === aba ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
            {aba}
          </button>
        ))}
      </section>

      {abaAtiva === 'Cadastro' && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cadastro de colaboradores</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
              onClick={() =>
                setColaboradores((atual) => [
                  ...atual,
                  {
                    id: atual.length + 1,
                    nome: `Novo colaborador ${atual.length + 1}`,
                    equipe: 'Operacional',
                    funcao: 'Analista',
                    tipoContratacao: 'Horário comercial',
                    horarioContratual: '09:00 às 18:00',
                    clienteArea: 'Operações',
                    usaValeTransporte: true,
                    escalaPadrao: 'Administrativa',
                    horariosPorDia: { seg: '09:00-18:00', ter: '09:00-18:00', qua: '09:00-18:00', qui: '09:00-18:00', sex: '09:00-18:00' },
                  },
                ])
              }
            >
              + Adicionar colaborador
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="p-2">Nome</th>
                  <th className="p-2">Equipe</th>
                  <th className="p-2">Função</th>
                  <th className="p-2">Contratação</th>
                  <th className="p-2">Horário</th>
                  <th className="p-2">Escala padrão</th>
                  <th className="p-2">VT</th>
                  <th className="p-2">Horários por dia útil</th>
                </tr>
              </thead>
              <tbody>
                {colaboradores.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800">
                    <td className="p-2">{c.nome}</td>
                    <td className="p-2">{c.equipe}</td>
                    <td className="p-2">{c.funcao}</td>
                    <td className="p-2">{c.tipoContratacao}</td>
                    <td className="p-2">{c.horarioContratual}</td>
                    <td className="p-2">{c.escalaPadrao}</td>
                    <td className="p-2">{c.usaValeTransporte ? 'Sim' : 'Não'}</td>
                    <td className="p-2 text-xs text-slate-400">
                      {diasSemanaOrdem
                        .filter((d) => c.horariosPorDia[d])
                        .map((d) => `${d.toUpperCase()}: ${c.horariosPorDia[d]}`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {abaAtiva === 'ESCALA DE TRABALHO (NOC E SD)' && renderTabelaEscala('ESCALA DE TRABALHO (NOC E SD)', nocSd, escalaNoc, setEscalaNoc, statusTurnos)}
      {abaAtiva === 'ESCALA DE TRABALHO OPERACIONAL' && renderTabelaEscala('ESCALA DE TRABALHO OPERACIONAL', operacional, escalaOperacional, setEscalaOperacional, statusTurnos)}
      {abaAtiva === 'PLANTÃO SUPORTE (INFRA)' && renderTabelaEscala('PLANTÃO SUPORTE (INFRA)', infra, escalaPlantao, setEscalaPlantao, statusPlantao)}
      {abaAtiva === 'ESCALA DE VALE TRANSPORTE' &&
        renderTabelaEscala('ESCALA DE VALE TRANSPORTE', colaboradores.filter((c) => c.usaValeTransporte), escalaVale, setEscalaVale, statusVale)}

      {abaAtiva === 'FERIADOS' && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cadastro de feriados</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
              onClick={() =>
                setFeriados((atual) => [
                  ...atual,
                  {
                    id: atual.length + 1,
                    data: `${ano}-${String(mes).padStart(2, '0')}-15`,
                    nome: `Feriado corporativo ${atual.length + 1}`,
                    tipo: 'Corporativo',
                  },
                ])
              }
            >
              + Adicionar feriado
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="p-2">Data</th>
                <th className="p-2">Nome do feriado</th>
                <th className="p-2">Dia da semana</th>
                <th className="p-2">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id} className="border-b border-slate-800">
                  <td className="p-2">{new Date(f.data).toLocaleDateString('pt-BR')}</td>
                  <td className="p-2">{f.nome}</td>
                  <td className="p-2">{new Date(f.data).toLocaleDateString('pt-BR', { weekday: 'long' })}</td>
                  <td className="p-2">{f.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {abaAtiva === 'Configuração' && (
        <section className="card space-y-3 text-sm">
          <h3 className="text-lg font-semibold">Configurações gerais do sistema</h3>
          <p className="text-slate-300">Parâmetros centrais alimentando todas as escalas.</p>
          <ul className="list-disc space-y-1 pl-6 text-slate-300">
            <li>Mês e ano da escala (definem quantidade de dias e dia da semana automaticamente).</li>
            <li>Regras de preenchimento automático por escala padrão do colaborador.</li>
            <li>Feriados impactando visualmente todas as escalas mensais.</li>
            <li>Nomes vindos da aba Cadastro para evitar retrabalho.</li>
          </ul>
        </section>
      )}

      {abaAtiva === 'Escala padrão' && (
        <section className="card space-y-4 text-sm">
          <h3 className="text-lg font-semibold">Modelos de escala reutilizáveis</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <h4 className="font-medium text-white">Escala 12x36</h4>
              <p className="mt-2 text-slate-300">Dia 1 — Trabalho (T1)</p>
              <p className="text-slate-300">Dia 2 — Folga</p>
              <p className="text-slate-300">Dia 3 — Trabalho (T1)</p>
              <p className="text-slate-300">Dia 4 — Folga</p>
            </article>
            <article className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <h4 className="font-medium text-white">Escala administrativa</h4>
              <p className="mt-2 text-slate-300">Seg-Sex — Trabalho (T2)</p>
              <p className="text-slate-300">Sáb-Dom — Folga</p>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}
