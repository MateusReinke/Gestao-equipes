'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plane } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '@/components/ui';
import { AUSENCIA_LABELS, todayInput } from '@/lib/format';

type Colaborador = { id: number; nome: string; equipe: { nome: string } };
type Aba = 'ferias' | 'ausencia' | null;

export function HrForms({
  colaboradores,
  podeSolicitarFerias,
  podeRegistrarAusencia,
}: {
  colaboradores: Colaborador[];
  podeSolicitarFerias: boolean;
  podeRegistrarAusencia: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviar(event: FormEvent<HTMLFormElement>, endpoint: string, montarPayload: (form: FormData) => unknown, mensagem: string) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSucesso(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPayload(formData)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível registrar');
        return;
      }

      setSucesso(mensagem);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (colaboradores.length === 0) {
    return <Alert tone="info">Cadastre colaboradores para registrar férias e ausências.</Alert>;
  }

  if (aba === null) {
    return (
      <div className="flex flex-wrap gap-2">
        {podeSolicitarFerias ? (
          <Button variant="primary" onClick={() => setAba('ferias')}>
            <Plane size={15} /> Solicitar férias
          </Button>
        ) : null}
        {podeRegistrarAusencia ? (
          <Button variant="secondary" onClick={() => setAba('ausencia')}>
            <ClipboardList size={15} /> Registrar ausência
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title={aba === 'ferias' ? 'Solicitar férias' : 'Registrar ausência'}
        description={
          aba === 'ferias'
            ? 'A solicitação fica pendente até alguém com permissão aprovar.'
            : 'Faltas, atestados, licenças, folgas e banco de horas.'
        }
        action={
          <Button variant="ghost" size="sm" onClick={() => { setAba(null); setError(null); setSucesso(null); }}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        {aba === 'ferias' ? (
          <form
            onSubmit={(event) =>
              enviar(
                event,
                '/api/ferias',
                (form) => ({
                  colaboradorId: Number(form.get('colaboradorId')),
                  dataInicio: String(form.get('dataInicio')),
                  dataFim: String(form.get('dataFim')),
                  observacao: String(form.get('observacao') || '') || undefined,
                }),
                'Solicitação de férias registrada.'
              )
            }
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Colaborador" htmlFor="colaboradorId" className="sm:col-span-2">
              <Select id="colaboradorId" name="colaboradorId" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nome} · {colaborador.equipe.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Início" htmlFor="dataInicio">
              <Input id="dataInicio" name="dataInicio" type="date" required defaultValue={todayInput()} />
            </Field>

            <Field label="Fim" htmlFor="dataFim">
              <Input id="dataFim" name="dataFim" type="date" required />
            </Field>

            <Field label="Observação" htmlFor="observacao" className="sm:col-span-2 lg:col-span-4">
              <Textarea id="observacao" name="observacao" rows={2} placeholder="Contexto que ajude quem vai aprovar." />
            </Field>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Enviando...' : 'Solicitar férias'}
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(event) =>
              enviar(
                event,
                '/api/ausencias',
                (form) => ({
                  colaboradorId: Number(form.get('colaboradorId')),
                  tipo: String(form.get('tipo')),
                  dataInicio: String(form.get('dataInicio')),
                  dataFim: String(form.get('dataFim')),
                  motivo: String(form.get('motivo') || '') || undefined,
                }),
                'Ausência registrada.'
              )
            }
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Colaborador" htmlFor="colaboradorIdAus" className="sm:col-span-2">
              <Select id="colaboradorIdAus" name="colaboradorId" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nome} · {colaborador.equipe.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tipo" htmlFor="tipo">
              <Select id="tipo" name="tipo" required defaultValue="atestado">
                {Object.entries(AUSENCIA_LABELS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="hidden lg:block" />

            <Field label="Início" htmlFor="dataInicioAus">
              <Input id="dataInicioAus" name="dataInicio" type="date" required defaultValue={todayInput()} />
            </Field>

            <Field label="Fim" htmlFor="dataFimAus">
              <Input id="dataFimAus" name="dataFim" type="date" required defaultValue={todayInput()} />
            </Field>

            <Field label="Motivo" htmlFor="motivo" className="sm:col-span-2">
              <Input id="motivo" name="motivo" placeholder="Atestado médico de 2 dias" />
            </Field>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Salvando...' : 'Registrar ausência'}
              </Button>
            </div>
          </form>
        )}

        {error ? <div className="mt-4"><Alert tone="danger">{error}</Alert></div> : null}
        {sucesso ? <div className="mt-4"><Alert tone="ok">{sucesso}</Alert></div> : null}
      </CardBody>
    </Card>
  );
}
