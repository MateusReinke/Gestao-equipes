'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

type Team = { id: number; nome: string };

export type ColaboradorExistente = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  tipoContrato: string;
  modeloTrabalho: string;
  fazPlantao: boolean;
  sobreAviso: boolean;
  ativo: boolean;
  equipe: { id: number; nome: string };
  dataAdmissao?: string | null;
  dataDesligamento?: string | null;
  dataNascimento?: string | null;
  matricula?: string | null;
  cpf?: string | null;
};

/// Datas vêm do backend em ISO com fuso; o input type=date quer só a data.
const paraInput = (valor?: string | null) => (valor ? valor.slice(0, 10) : '');

/**
 * Serve para cadastrar e para editar.
 * Sem `colaborador`, é um botão que abre o formulário em branco e faz POST.
 * Com `colaborador`, já nasce aberto e preenchido, e faz PATCH.
 */
export function CollaboratorForm({
  teams,
  colaborador,
  onFechar,
}: {
  teams: Team[];
  colaborador?: ColaboradorExistente;
  onFechar?: () => void;
}) {
  const edicao = colaborador != null;
  const id = (campo: string) => `${campo}-${colaborador?.id ?? 'novo'}`;
  const router = useRouter();
  const [aberto, setAberto] = useState(edicao);
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
      ativo: formData.get('ativo') !== 'false',
      // Campo de data vazio precisa virar null, não string vazia: o backend
      // interpretaria '' como data inválida.
      dataAdmissao: String(formData.get('dataAdmissao') || '') || null,
      dataDesligamento: String(formData.get('dataDesligamento') || '') || null,
      dataNascimento: String(formData.get('dataNascimento') || '') || null,
      matricula: String(formData.get('matricula') || '') || null,
      cpf: String(formData.get('cpf') || '') || null,
    };

    const form = event.currentTarget;

    try {
      const response = await fetch(edicao ? `/api/colaboradores/${colaborador.id}` : '/api/colaboradores', {
        method: edicao ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || (edicao ? 'Erro ao salvar o colaborador' : 'Erro ao cadastrar colaborador'));
        setIssues(data.issues || null);
        return;
      }

      setSucesso(true);
      if (!edicao) form.reset();
      router.refresh();
      if (edicao) onFechar?.();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a alteração já aparece na tabela.');
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
        title={edicao ? `Editar ${colaborador.nome}` : 'Novo colaborador'}
        description="A disponibilidade define quem pode ser escalado para plantão e sobreaviso."
        action={
          <Button variant="ghost" size="sm" onClick={() => { setAberto(false); onFechar?.(); }}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" htmlFor={id('nome')}>
            <Input id={id('nome')} name="nome" required minLength={3} placeholder="Ana Lima" defaultValue={colaborador?.nome ?? ''} />
          </Field>

          <Field label="E-mail" htmlFor={id('email')}>
            <Input id={id('email')} name="email" type="email" required placeholder="ana.lima@empresa.com" defaultValue={colaborador?.email ?? ''} />
          </Field>

          <Field label="Telefone" htmlFor={id('telefone')} hint="DDD + número">
            <Input id={id('telefone')} name="telefone" required pattern="[\d\s()-]{10,20}" placeholder="11988887777" inputMode="tel" defaultValue={colaborador?.telefone ?? ''} />
          </Field>

          <Field label="Cargo / função" htmlFor={id('cargo')}>
            <Input id={id('cargo')} name="cargo" required minLength={2} placeholder="Analista de NOC" defaultValue={colaborador?.cargo ?? ''} />
          </Field>

          <Field label="Equipe" htmlFor={id('equipeId')}>
            <Select id={id('equipeId')} name="equipeId" required defaultValue={colaborador?.equipe.id != null ? String(colaborador.equipe.id) : ''}>
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

          <Field label="Tipo de contrato" htmlFor={id('tipoContrato')}>
            <Select id={id('tipoContrato')} name="tipoContrato" required defaultValue={colaborador?.tipoContrato ?? 'clt'}>
              <option value="clt">CLT</option>
              <option value="pj">PJ</option>
              <option value="terceirizado">Terceirizado</option>
              <option value="estagio">Estágio</option>
            </Select>
          </Field>

          <Field label="Modelo de trabalho" htmlFor={id('modeloTrabalho')}>
            <Select id={id('modeloTrabalho')} name="modeloTrabalho" required defaultValue={colaborador?.modeloTrabalho ?? 'presencial'}>
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
              <option value="remoto">Remoto</option>
            </Select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="eyebrow mb-3 border-t border-line pt-4">Cadastro funcional</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Data de admissão"
                htmlFor={id('dataAdmissao')}
                hint="Base do cálculo de férias — sem ela não há ciclo"
              >
                <Input
                  id={id('dataAdmissao')}
                  name="dataAdmissao"
                  type="date"
                  defaultValue={paraInput(colaborador?.dataAdmissao)}
                />
              </Field>

              <Field label="Data de desligamento" htmlFor={id('dataDesligamento')} hint="Deixe vazio se está na ativa">
                <Input
                  id={id('dataDesligamento')}
                  name="dataDesligamento"
                  type="date"
                  defaultValue={paraInput(colaborador?.dataDesligamento)}
                />
              </Field>

              <Field label="Data de nascimento" htmlFor={id('dataNascimento')} hint="Opcional">
                <Input
                  id={id('dataNascimento')}
                  name="dataNascimento"
                  type="date"
                  defaultValue={paraInput(colaborador?.dataNascimento)}
                />
              </Field>

              <Field label="Matrícula" htmlFor={id('matricula')} hint="Opcional">
                <Input id={id('matricula')} name="matricula" maxLength={40} defaultValue={colaborador?.matricula ?? ''} />
              </Field>

              <Field label="CPF" htmlFor={id('cpf')} hint="Opcional — os dígitos são conferidos">
                <Input
                  id={id('cpf')}
                  name="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  defaultValue={colaborador?.cpf ?? ''}
                />
              </Field>
            </div>
          </div>

          <fieldset className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-2">
            <legend className="field-label">Disponibilidade para escala</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="fazPlantao" defaultChecked={colaborador?.fazPlantao ?? false} className="rounded border-line bg-bg" /> Faz plantão
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="sobreAviso" defaultChecked={colaborador?.sobreAviso ?? false} className="rounded border-line bg-bg" /> Fica de sobreaviso
              </label>
            </div>
          </fieldset>

          <Field
            label="Situação"
            htmlFor={id('ativo')}
            hint="Inativo sai da geração de turnos e das listas, sem apagar o histórico"
          >
            <Select id={id('ativo')} name="ativo" defaultValue={colaborador && !colaborador.ativo ? 'false' : 'true'}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Salvando...' : edicao ? 'Salvar alterações' : 'Cadastrar colaborador'}
            </Button>
            {sucesso ? (
              <span className="text-xs text-ok">{edicao ? 'Alterações salvas.' : 'Colaborador cadastrado com sucesso.'}</span>
            ) : null}
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
