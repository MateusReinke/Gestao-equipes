'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

type Team = { id: number; nome: string };

export function CollaboratorForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get('nome') || ''),
      email: String(formData.get('email') || ''),
      telefone: String(formData.get('telefone') || '').replace(/\D/g, ''),
      cargo: String(formData.get('cargo') || ''),
      equipeId: Number(formData.get('equipeId')),
      tipoContrato: String(formData.get('tipoContrato') || ''),
      modeloTrabalho: String(formData.get('modeloTrabalho') || ''),
      fazPlantao: formData.get('fazPlantao') === 'on',
      sobreAviso: formData.get('sobreAviso') === 'on',
      ativo: true,
    };

    try {
      const response = await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao cadastrar colaborador');
        setIssues(data.issues || null);
        return;
      }

      setSucesso(true);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se o colaborador já aparece na tabela.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (teams.length === 0) {
    return <Alert tone="info">Crie uma equipe antes de cadastrar colaboradores — todo colaborador precisa pertencer a uma.</Alert>;
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <UserPlus size={15} /> Cadastrar colaborador
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Novo colaborador"
        description="A disponibilidade define quem pode ser escalado para plantão e sobreaviso."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" htmlFor="nome">
            <Input id="nome" name="nome" required minLength={3} placeholder="Ana Lima" />
          </Field>

          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" required placeholder="ana.lima@empresa.com" />
          </Field>

          <Field label="Telefone" htmlFor="telefone" hint="DDD + número">
            <Input id="telefone" name="telefone" required pattern="[\d\s()-]{10,20}" placeholder="11988887777" inputMode="tel" />
          </Field>

          <Field label="Cargo / função" htmlFor="cargo">
            <Input id="cargo" name="cargo" required minLength={2} placeholder="Analista de NOC" />
          </Field>

          <Field label="Equipe" htmlFor="equipeId">
            <Select id="equipeId" name="equipeId" required defaultValue="">
              <option value="" disabled>
                Selecione...
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de contrato" htmlFor="tipoContrato">
            <Select id="tipoContrato" name="tipoContrato" required defaultValue="clt">
              <option value="clt">CLT</option>
              <option value="pj">PJ</option>
              <option value="terceirizado">Terceirizado</option>
              <option value="estagio">Estágio</option>
            </Select>
          </Field>

          <Field label="Modelo de trabalho" htmlFor="modeloTrabalho">
            <Select id="modeloTrabalho" name="modeloTrabalho" required defaultValue="presencial">
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
              <option value="remoto">Remoto</option>
            </Select>
          </Field>

          <fieldset className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-2">
            <legend className="field-label">Disponibilidade para escala</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="fazPlantao" className="rounded border-line bg-bg" /> Faz plantão
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="sobreAviso" className="rounded border-line bg-bg" /> Fica de sobreaviso
              </label>
            </div>
          </fieldset>

          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Salvando...' : 'Cadastrar colaborador'}
            </Button>
            {sucesso ? <span className="text-xs text-ok">Colaborador cadastrado com sucesso.</span> : null}
          </div>

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
