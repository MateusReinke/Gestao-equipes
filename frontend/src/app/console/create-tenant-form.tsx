'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';

export function CreateTenantForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = { nome: String(formData.get('nome') || ''), slug: String(formData.get('slug') || '') };

    try {
      const response = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao criar empresa');
        return;
      }

      event.currentTarget.reset();
      setAberto(false);
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a empresa já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Plus size={15} /> Nova empresa
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Nova empresa"
        description="O identificador é usado internamente e não pode se repetir."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome" htmlFor="nome">
            <Input id="nome" name="nome" required minLength={2} placeholder="Acme Corp" />
          </Field>

          <Field label="Identificador (slug)" htmlFor="slug" hint="letras minúsculas, números e hífen">
            <Input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="acme" />
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Criando...' : 'Criar empresa'}
            </Button>
          </div>

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
