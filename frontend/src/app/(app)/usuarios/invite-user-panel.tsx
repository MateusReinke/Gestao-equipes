'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

type Papel = { id: number; nome: string; descricao: string };
type Colaborador = { id: number; nome: string };

export function InviteUserPanel({ papeis, colaboradores }: { papeis: Papel[]; colaboradores: Colaborador[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [papelId, setPapelId] = useState('');

  const papelSelecionado = papeis.find((papel) => String(papel.id) === papelId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const colaboradorRaw = String(formData.get('colaboradorId') || '');
    const payload = {
      nome: String(formData.get('nome') || ''),
      email: String(formData.get('email') || ''),
      senha: String(formData.get('senha') || ''),
      roleId: Number(formData.get('roleId')),
      colaboradorId: colaboradorRaw ? Number(colaboradorRaw) : null,
    };

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível adicionar o usuário');
        setIssues(data.issues || null);
        return;
      }

      setSucesso(true);
      event.currentTarget.reset();
      setPapelId('');
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <UserPlus size={15} /> Adicionar usuário
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Adicionar usuário"
        description="Se o e-mail já existir na plataforma, a conta é apenas vinculada a esta empresa — a pessoa continua com a mesma senha."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome" htmlFor="nome">
            <Input id="nome" name="nome" required minLength={3} placeholder="Marina Gestora" />
          </Field>

          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" required placeholder="marina@empresa.com" />
          </Field>

          <Field label="Senha inicial" htmlFor="senha" hint="Mínimo de 8 caracteres">
            <Input id="senha" name="senha" type="password" required minLength={8} autoComplete="new-password" />
          </Field>

          <Field label="Papel" htmlFor="roleId">
            <Select id="roleId" name="roleId" required value={papelId} onChange={(e) => setPapelId(e.target.value)}>
              <option value="" disabled>Selecione...</option>
              {papeis.map((papel) => (
                <option key={papel.id} value={papel.id}>
                  {papel.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Colaborador vinculado" htmlFor="colaboradorId" hint="Necessário para pedir troca dos próprios turnos">
            <Select id="colaboradorId" name="colaboradorId" defaultValue="">
              <option value="">Nenhum</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Salvando...' : 'Adicionar usuário'}
            </Button>
          </div>

          {papelSelecionado ? (
            <p className="rounded-lg bg-surface-raised px-3 py-2 text-2xs text-ink-muted sm:col-span-2 lg:col-span-3">
              <strong className="font-medium text-ink">{papelSelecionado.nome}:</strong> {papelSelecionado.descricao}
            </p>
          ) : null}

          {sucesso ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Alert tone="ok">Usuário adicionado com sucesso.</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
          {issues ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Alert tone="danger">
                <ul className="list-inside list-disc">
                  {Object.entries(issues).map(([campo, mensagens]) =>
                    mensagens?.map((mensagem) => <li key={`${campo}-${mensagem}`}>{mensagem}</li>)
                  )}
                </ul>
              </Alert>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
