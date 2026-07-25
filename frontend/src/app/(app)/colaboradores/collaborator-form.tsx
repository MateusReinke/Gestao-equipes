'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Team = { id: number; nome: string };

export function CollaboratorForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get('nome') || ''),
      email: String(formData.get('email') || ''),
      telefone: String(formData.get('telefone') || ''),
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
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao adicionar colaborador');
        setIssues(data.issues || null);
        return;
      }

      setSuccess(true);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Falha de comunicação com o servidor');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2">
      <h2 className="col-span-full text-base font-semibold text-white">Adicionar colaborador</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" required minLength={3} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="telefone">Telefone (DDD + número)</label>
        <input id="telefone" name="telefone" required pattern="\d{10,11}" placeholder="11988887777" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="cargo">Cargo / função</label>
        <input id="cargo" name="cargo" required minLength={2} placeholder="Analista de NOC" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="equipeId">Equipe</label>
        <select id="equipeId" name="equipeId" required defaultValue="" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="" disabled>Selecione...</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.nome}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="tipoContrato">Tipo de contrato</label>
        <select id="tipoContrato" name="tipoContrato" required defaultValue="clt" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="clt">CLT</option>
          <option value="pj">PJ</option>
          <option value="terceirizado">Terceirizado</option>
          <option value="estagio">Estágio</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="modeloTrabalho">Modelo de trabalho</label>
        <select id="modeloTrabalho" name="modeloTrabalho" required defaultValue="presencial" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="presencial">Presencial</option>
          <option value="hibrido">Híbrido</option>
          <option value="remoto">Remoto</option>
        </select>
      </div>

      <fieldset className="flex flex-col justify-center gap-2">
        <legend className="text-xs text-slate-400">Disponibilidade para escala</legend>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="fazPlantao" className="rounded border-slate-700 bg-slate-950" />
          Faz plantão
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="sobreAviso" className="rounded border-slate-700 bg-slate-950" />
          Fica de sobreaviso
        </label>
      </fieldset>

      <div className="col-span-full flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? 'Salvando...' : 'Adicionar colaborador'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Colaborador adicionado com sucesso.</p>}
      </div>
      {issues && (
        <ul className="col-span-full list-inside list-disc text-xs text-red-400">
          {Object.entries(issues).map(([field, messages]) =>
            messages?.map((message) => <li key={`${field}-${message}`}>{message}</li>)
          )}
        </ul>
      )}
    </form>
  );
}
