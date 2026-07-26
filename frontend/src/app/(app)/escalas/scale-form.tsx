'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Plus, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';
import { ESCALA_DESCRICOES, todayInput, weekdayLabel } from '@/lib/format';

type Colaborador = { id: number; nome: string; equipe: { nome: string } };
type Cliente = { id: number; nome: string };
type Janela = { diaSemana: number; horaInicio: string; horaFim: string };

const DIAS = [0, 1, 2, 3, 4, 5, 6];

/// Presets cobrem os casos mais comuns; a pessoa ajusta depois se precisar.
const PRESETS: Record<string, { dias: number[]; horarios: Array<{ inicio: string; fim: string }> }> = {
  doze_por_trinta_seis: { dias: DIAS, horarios: [{ inicio: '07:00', fim: '19:00' }] },
  cinco_por_dois: { dias: [1, 2, 3, 4, 5], horarios: [{ inicio: '08:00', fim: '17:00' }] },
  personalizada: { dias: [1, 2, 3, 4, 5], horarios: [{ inicio: '06:00', fim: '14:00' }, { inicio: '14:00', fim: '22:00' }] },
};

function montarJanelas(tipo: string): Janela[] {
  const preset = PRESETS[tipo] ?? PRESETS.cinco_por_dois;
  return preset.dias.flatMap((diaSemana) =>
    preset.horarios.map((horario) => ({ diaSemana, horaInicio: horario.inicio, horaFim: horario.fim }))
  );
}

export function ScaleForm({ colaboradores, clientes }: { colaboradores: Colaborador[]; clientes: Cliente[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [tipo, setTipo] = useState('doze_por_trinta_seis');
  const [janelas, setJanelas] = useState<Janela[]>(() => montarJanelas('doze_por_trinta_seis'));
  const [rotacao, setRotacao] = useState<number[]>([]);

  function trocarTipo(novoTipo: string) {
    setTipo(novoTipo);
    setJanelas(montarJanelas(novoTipo));
  }

  function adicionarJanela() {
    setJanelas((atual) => [...atual, { diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' }]);
  }

  function atualizarJanela(index: number, campo: keyof Janela, valor: string) {
    setJanelas((atual) =>
      atual.map((janela, i) => (i === index ? { ...janela, [campo]: campo === 'diaSemana' ? Number(valor) : valor } : janela))
    );
  }

  function removerJanela(index: number) {
    setJanelas((atual) => atual.filter((_, i) => i !== index));
  }

  function alternarColaborador(id: number) {
    setRotacao((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const clienteIdRaw = String(formData.get('clienteId') || '');
    const dataInicio = String(formData.get('dataInicio') || todayInput());

    const payload = {
      nome: String(formData.get('nome') || ''),
      tipo,
      descricao: String(formData.get('descricao') || ''),
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      detalhes: janelas,
      // A ordem em que a pessoa marcou define a sequência do revezamento.
      atribuicoes: rotacao.map((colaboradorId, ordem) => ({ colaboradorId, ordem, dataInicio })),
    };

    try {
      const response = await fetch('/api/escalas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao criar escala');
        return;
      }

      setSucesso(true);
      event.currentTarget.reset();
      setRotacao([]);
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a escala já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (colaboradores.length === 0) {
    return <Alert tone="info">Cadastre colaboradores antes de criar uma escala — são eles que entram no revezamento.</Alert>;
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <CalendarPlus size={15} /> Criar escala
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Nova escala"
        description="Defina os horários e a ordem do revezamento. Depois é só gerar os turnos no calendário."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome da escala" htmlFor="nome">
              <Input id="nome" name="nome" required minLength={2} placeholder="NOC 12x36" />
            </Field>

            <Field label="Tipo" htmlFor="tipo">
              <Select id="tipo" value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
                <option value="doze_por_trinta_seis">12x36 — revezamento diário</option>
                <option value="cinco_por_dois">5x2 — escala fixa</option>
                <option value="personalizada">Personalizada — revezamento por faixa</option>
              </Select>
            </Field>

            <Field label="Cliente" htmlFor="clienteId" hint="Opcional">
              <Select id="clienteId" name="clienteId" defaultValue="">
                <option value="">Uso interno</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Início da vigência" htmlFor="dataInicio" hint="Âncora do revezamento">
              <Input id="dataInicio" name="dataInicio" type="date" required defaultValue={todayInput()} />
            </Field>

            <Field label="Descrição" htmlFor="descricao" className="sm:col-span-2 lg:col-span-4">
              <Input id="descricao" name="descricao" required minLength={2} placeholder="Cobertura contínua do NOC, revezada entre dois analistas." />
            </Field>
          </div>

          <p className="rounded-lg bg-surface-raised px-3 py-2 text-2xs text-ink-muted">{ESCALA_DESCRICOES[tipo]}</p>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Faixas de horário ({janelas.length})</p>
              <Button type="button" variant="ghost" size="sm" onClick={adicionarJanela}>
                <Plus size={14} /> Adicionar faixa
              </Button>
            </div>

            {janelas.length === 0 ? (
              <Alert tone="warn">Defina ao menos uma faixa de horário.</Alert>
            ) : (
              <div className="scroll-x">
                <div className="flex min-w-full flex-col gap-2">
                  {janelas.map((janela, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-raised p-2">
                      <Select
                        aria-label="Dia da semana"
                        value={janela.diaSemana}
                        onChange={(e) => atualizarJanela(index, 'diaSemana', e.target.value)}
                        className="w-32 py-1.5 text-xs"
                      >
                        {DIAS.map((dia) => (
                          <option key={dia} value={dia}>
                            {weekdayLabel(dia)}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label="Hora inicial"
                        type="time"
                        value={janela.horaInicio}
                        onChange={(e) => atualizarJanela(index, 'horaInicio', e.target.value)}
                        className="w-28 py-1.5 text-xs"
                      />
                      <span className="text-xs text-ink-subtle">até</span>
                      <Input
                        aria-label="Hora final"
                        type="time"
                        value={janela.horaFim}
                        onChange={(e) => atualizarJanela(index, 'horaFim', e.target.value)}
                        className="w-28 py-1.5 text-xs"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => removerJanela(index)} aria-label="Remover faixa">
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="eyebrow mb-1">Ordem do revezamento ({rotacao.length} selecionado(s))</p>
            <p className="mb-2 text-2xs text-ink-subtle">
              Clique nos colaboradores na ordem em que devem se revezar. O número mostra a posição na rotação.
            </p>
            <div className="flex flex-wrap gap-2">
              {colaboradores.map((colaborador) => {
                const posicao = rotacao.indexOf(colaborador.id);
                const selecionado = posicao >= 0;
                return (
                  <button
                    key={colaborador.id}
                    type="button"
                    onClick={() => alternarColaborador(colaborador.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      selecionado
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {selecionado ? (
                      <span className="tabular flex h-4 w-4 items-center justify-center rounded bg-accent text-2xs font-bold text-white">
                        {posicao + 1}
                      </span>
                    ) : null}
                    {colaborador.nome}
                    <span className="text-ink-subtle">{colaborador.equipe.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {sucesso ? <Alert tone="ok">Escala criada. Agora gere os turnos na página de Turnos.</Alert> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending || janelas.length === 0}>
              {pending ? 'Salvando...' : 'Criar escala'}
            </Button>
            {rotacao.length === 0 ? (
              <span className="text-2xs text-ink-subtle">Sem colaboradores no revezamento, a escala não gera turnos.</span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
