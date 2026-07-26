'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';
import { ESCALA_DESCRICOES, ESCALA_LABELS, addDays, toInputDate } from '@/lib/format';

type Escala = { id: number; nome: string; tipo: string };
type Conflito = { colaborador: string; data: string; motivo: string };
type Resultado = { criados: number; total: number; conflitos: Conflito[] };

export function GenerateShiftsPanel({ escalas, semanaAtual }: { escalas: Escala[]; semanaAtual: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [escalaId, setEscalaId] = useState<string>('');

  const escalaSelecionada = escalas.find((escala) => String(escala.id) === escalaId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResultado(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      escalaId: Number(formData.get('escalaId')),
      inicio: String(formData.get('inicio')),
      fim: String(formData.get('fim')),
      substituirExistentes: formData.get('substituirExistentes') === 'on',
    };

    try {
      const response = await fetch('/api/turnos/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível gerar os turnos');
        return;
      }

      setResultado(data as Resultado);
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor. Atualize a página para conferir o resultado.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (escalas.length === 0) {
    return (
      <Alert tone="info">
        Nenhuma escala cadastrada ainda. Crie uma escala primeiro para conseguir gerar os turnos automaticamente.
      </Alert>
    );
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Sparkles size={15} /> Gerar turnos a partir de uma escala
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Gerar turnos"
        description="Transforma as regras de uma escala em turnos concretos, dia a dia."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Escala" htmlFor="escalaId" className="sm:col-span-2 lg:col-span-1">
            <Select id="escalaId" name="escalaId" required value={escalaId} onChange={(e) => setEscalaId(e.target.value)}>
              <option value="">Selecione...</option>
              {escalas.map((escala) => (
                <option key={escala.id} value={escala.id}>
                  {escala.nome} ({ESCALA_LABELS[escala.tipo] ?? escala.tipo})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="De" htmlFor="inicio">
            <Input id="inicio" name="inicio" type="date" required defaultValue={semanaAtual} />
          </Field>

          <Field label="Até" htmlFor="fim">
            <Input id="fim" name="fim" type="date" required defaultValue={toInputDate(addDays(semanaAtual, 27))} />
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Gerando...' : 'Gerar turnos'}
            </Button>
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-muted sm:col-span-2 lg:col-span-4">
            <input type="checkbox" name="substituirExistentes" className="rounded border-line bg-bg" />
            Substituir turnos já gerados desta escala no período (turnos que vieram de trocas aprovadas são preservados)
          </label>

          {escalaSelecionada ? (
            <p className="rounded-lg bg-surface-raised px-3 py-2 text-2xs text-ink-muted sm:col-span-2 lg:col-span-4">
              <strong className="font-medium text-ink">{ESCALA_LABELS[escalaSelecionada.tipo]}:</strong>{' '}
              {ESCALA_DESCRICOES[escalaSelecionada.tipo]}
            </p>
          ) : null}
        </form>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        {resultado ? (
          <div className="mt-4 space-y-3">
            <Alert tone={resultado.criados > 0 ? 'ok' : 'warn'}>
              {resultado.criados > 0
                ? `${resultado.criados} turno(s) criado(s) de ${resultado.total} previsto(s).`
                : 'Nenhum turno novo foi criado — provavelmente eles já existiam neste período.'}
            </Alert>

            {resultado.conflitos.length > 0 ? (
              <div className="rounded-lg border border-warn/30 bg-warn-soft p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                  <TriangleAlert size={14} />
                  {resultado.conflitos.length} turno(s) caem em período de indisponibilidade
                </p>
                <p className="mt-1 text-2xs text-warn/80">
                  Os turnos foram criados mesmo assim, para você enxergar a lacuna e decidir a cobertura.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {resultado.conflitos.slice(0, 12).map((conflito, index) => (
                    <li key={`${conflito.colaborador}-${conflito.data}-${index}`}>
                      <Badge tone="warn">
                        {conflito.colaborador} · {conflito.data} · {conflito.motivo}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {resultado.conflitos.length > 12 ? (
                  <p className="mt-2 text-2xs text-warn/80">e mais {resultado.conflitos.length - 12}...</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
