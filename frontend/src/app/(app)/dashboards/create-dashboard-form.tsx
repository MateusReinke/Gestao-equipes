'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';

export function CreateDashboardForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get('nome') || ''),
      descricao: String(formData.get('descricao') || '') || null,
    };

    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao criar dashboard');
        return;
      }

      // Painel novo nasce vazio: mandar direto para o editor evita a tela em branco.
      router.push(`/dashboards/${data.id}/editar`);
    } catch {
      setError('Não foi possível confirmar a resposta do servidor. Recarregue a página para conferir.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Plus size={15} /> Novo dashboard
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Novo dashboard"
        description="Depois de criar, você escolhe os widgets no editor."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome" htmlFor="nome">
            <Input id="nome" name="nome" required minLength={2} maxLength={80} placeholder="Operação NOC — turno da noite" />
          </Field>

          <Field label="Descrição" htmlFor="descricao" hint="Opcional">
            <Input id="descricao" name="descricao" maxLength={300} placeholder="Painel de acompanhamento diário" />
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Criando...' : 'Criar e montar'}
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
