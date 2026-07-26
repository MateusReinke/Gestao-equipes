'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

type Client = { id: number; nome: string };

export type EquipeExistente = { id: number; nome: string; ativo: boolean; cliente?: { id: number } | null };

/**
 * Serve para criar e para editar.
 * Sem `equipe`, é um botão que abre o formulário em branco e faz POST.
 * Com `equipe`, já nasce aberto e preenchido, e faz PATCH.
 */
export function TeamForm({
  clients,
  equipe,
  onFechar,
}: {
  clients: Client[];
  equipe?: EquipeExistente;
  onFechar?: () => void;
}) {
  const edicao = equipe != null;
  const router = useRouter();
  const [aberto, setAberto] = useState(edicao);
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
      ativo: formData.get('ativo') === 'false' ? false : true,
    };

    const form = event.currentTarget;

    try {
      const response = await fetch(edicao ? `/api/equipes/${equipe.id}` : '/api/equipes', {
        method: edicao ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || (edicao ? 'Erro ao salvar a equipe' : 'Erro ao criar equipe'));
        return;
      }

      setSucesso(true);
      if (!edicao) form.reset();
      router.refresh();
      if (edicao) onFechar?.();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a alteração já aparece abaixo.');
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
        title={edicao ? `Editar ${equipe.nome}` : 'Nova equipe'}
        description="O cliente é opcional — equipes internas não precisam estar vinculadas a um."
        action={
          <Button variant="ghost" size="sm" onClick={() => { setAberto(false); onFechar?.(); }}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
          <Field label="Nome da equipe" htmlFor={`nome-${equipe?.id ?? 'novo'}`}>
            <Input
              id={`nome-${equipe?.id ?? 'novo'}`}
              name="nome"
              required
              minLength={2}
              placeholder="NOC 24x7"
              defaultValue={equipe?.nome ?? ''}
            />
          </Field>

          <Field label="Cliente atendido" htmlFor={`clienteId-${equipe?.id ?? 'novo'}`} hint="Opcional">
            <Select
              id={`clienteId-${equipe?.id ?? 'novo'}`}
              name="clienteId"
              defaultValue={equipe?.cliente?.id != null ? String(equipe.cliente.id) : ''}
            >
              <option value="">Estrutura interna</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Situação"
            htmlFor={`ativo-${equipe?.id ?? 'novo'}`}
            hint="Equipe inativa some das listas de seleção"
          >
            <Select
              id={`ativo-${equipe?.id ?? 'novo'}`}
              name="ativo"
              defaultValue={equipe && !equipe.ativo ? 'false' : 'true'}
            >
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </Select>
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Salvando...' : edicao ? 'Salvar' : 'Criar equipe'}
            </Button>
          </div>

          {sucesso ? (
            <div className="sm:col-span-4">
              <Alert tone="ok">{edicao ? 'Alterações salvas.' : 'Equipe criada com sucesso.'}</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="sm:col-span-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
