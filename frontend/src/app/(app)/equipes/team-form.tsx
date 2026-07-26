'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

type Client = { id: number; nome: string };

export function TeamForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const clienteIdRaw = String(formData.get('clienteId') || '');
    const payload = {
      nome: String(formData.get('nome') || ''),
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      ativo: true,
    };

    try {
      const response = await fetch('/api/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao criar equipe');
        return;
      }

      setSucesso(true);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a equipe já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Users size={15} /> Criar equipe
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Nova equipe"
        description="O cliente é opcional — equipes internas não precisam estar vinculadas a um."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome da equipe" htmlFor="nome">
            <Input id="nome" name="nome" required minLength={2} placeholder="NOC 24x7" />
          </Field>

          <Field label="Cliente atendido" htmlFor="clienteId" hint="Opcional">
            <Select id="clienteId" name="clienteId" defaultValue="">
              <option value="">Estrutura interna</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nome}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Salvando...' : 'Criar equipe'}
            </Button>
          </div>

          {sucesso ? (
            <div className="sm:col-span-3">
              <Alert tone="ok">Equipe criada com sucesso.</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="sm:col-span-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
