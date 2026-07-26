'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat2 } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '@/components/ui';
import { formatDate, weekdayName } from '@/lib/format';

type Colaborador = { id: number; nome: string; equipe: { nome: string } };
type Turno = { id: number; data: string; horaInicio: string; horaFim: string; cliente?: { nome: string } | null };

function TurnoOption({ turno }: { turno: Turno }) {
  return (
    <option value={turno.id}>
      {weekdayName(turno.data, true)} {formatDate(turno.data)} · {turno.horaInicio}–{turno.horaFim}
      {turno.cliente ? ` · ${turno.cliente.nome}` : ''}
    </option>
  );
}

export function RequestSwapPanel({ colaboradores }: { colaboradores: Colaborador[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [tipo, setTipo] = useState<'troca' | 'cobertura'>('troca');
  const [solicitanteId, setSolicitanteId] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [turnosSolicitante, setTurnosSolicitante] = useState<Turno[]>([]);
  const [turnosDestinatario, setTurnosDestinatario] = useState<Turno[]>([]);

  // Carrega os turnos de cada pessoa para o usuário escolher qual dia trocar.
  useEffect(() => {
    if (!solicitanteId) return setTurnosSolicitante([]);
    fetch(`/api/turnos/colaborador/${solicitanteId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setTurnosSolicitante(Array.isArray(data) ? data : []))
      .catch(() => setTurnosSolicitante([]));
  }, [solicitanteId]);

  useEffect(() => {
    if (!destinatarioId) return setTurnosDestinatario([]);
    fetch(`/api/turnos/colaborador/${destinatarioId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setTurnosDestinatario(Array.isArray(data) ? data : []))
      .catch(() => setTurnosDestinatario([]));
  }, [destinatarioId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const turnoDestinoRaw = String(formData.get('turnoDestinoId') || '');
    const payload = {
      tipo,
      turnoOrigemId: Number(formData.get('turnoOrigemId')),
      destinatarioId: Number(formData.get('destinatarioId')),
      turnoDestinoId: tipo === 'troca' && turnoDestinoRaw ? Number(turnoDestinoRaw) : null,
      motivo: String(formData.get('motivo') || ''),
    };

    try {
      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível registrar o pedido');
        return;
      }

      setSucesso(true);
      event.currentTarget.reset();
      setSolicitanteId('');
      setDestinatarioId('');
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor. Atualize a página para conferir.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Repeat2 size={15} /> Solicitar troca de turno
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Solicitar troca"
        description="Escolha o turno que você quer passar e, se for troca mútua, o turno do colega que você vai assumir."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de pedido" htmlFor="tipo" className="sm:col-span-2">
            <Select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'troca' | 'cobertura')}>
              <option value="troca">Troca mútua — cada um assume o dia do outro</option>
              <option value="cobertura">Cobertura — o colega assume meu turno, sem contrapartida</option>
            </Select>
          </Field>

          <Field label="Quem está pedindo" htmlFor="solicitanteId" hint="O turno abaixo é escolhido a partir desta pessoa">
            <Select id="solicitanteId" required value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
              <option value="">Selecione...</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome} · {colaborador.equipe.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Turno que será passado"
            htmlFor="turnoOrigemId"
            hint={solicitanteId && turnosSolicitante.length === 0 ? 'Esta pessoa não tem turnos futuros programados' : undefined}
          >
            <Select id="turnoOrigemId" name="turnoOrigemId" required disabled={!solicitanteId}>
              <option value="">{solicitanteId ? 'Selecione o dia...' : 'Escolha a pessoa primeiro'}</option>
              {turnosSolicitante.map((turno) => (
                <TurnoOption key={turno.id} turno={turno} />
              ))}
            </Select>
          </Field>

          <Field label="Colega" htmlFor="destinatarioId">
            <Select id="destinatarioId" name="destinatarioId" required value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)}>
              <option value="">Selecione...</option>
              {colaboradores
                .filter((colaborador) => String(colaborador.id) !== solicitanteId)
                .map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nome} · {colaborador.equipe.nome}
                  </option>
                ))}
            </Select>
          </Field>

          {tipo === 'troca' ? (
            <Field
              label="Turno do colega que será assumido"
              htmlFor="turnoDestinoId"
              hint={destinatarioId && turnosDestinatario.length === 0 ? 'Este colega não tem turnos futuros programados' : undefined}
            >
              <Select id="turnoDestinoId" name="turnoDestinoId" required disabled={!destinatarioId}>
                <option value="">{destinatarioId ? 'Selecione o dia...' : 'Escolha o colega primeiro'}</option>
                {turnosDestinatario.map((turno) => (
                  <TurnoOption key={turno.id} turno={turno} />
                ))}
              </Select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Field label="Motivo" htmlFor="motivo" className="sm:col-span-2" hint="Fica registrado no histórico e ajuda quem vai aprovar">
            <Textarea id="motivo" name="motivo" required minLength={3} rows={2} placeholder="Ex.: consulta médica marcada nesse dia, já combinei com o colega." />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Enviando...' : 'Enviar pedido'}
            </Button>
            {sucesso ? <span className="text-xs text-ok">Pedido registrado. Aguardando resposta do colega.</span> : null}
          </div>

          {error ? (
            <div className="sm:col-span-2">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
