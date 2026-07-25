'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type TenantOption = { id: number; nome: string; slug: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[] | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  async function attemptLogin(tenantId?: number) {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, tenantId }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(payload.error || 'Não foi possível entrar. Verifique suas credenciais.');
      return;
    }

    if (payload.requiresTenantSelection) {
      setTenants(payload.tenants);
      return;
    }

    router.push('/');
    router.refresh();
  }

  function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    attemptLogin();
  }

  function handleTenantSubmit(event: FormEvent) {
    event.preventDefault();
    if (selectedTenantId != null) attemptLogin(selectedTenantId);
  }

  function handleBack() {
    setTenants(null);
    setSelectedTenantId(null);
    setError(null);
  }

  if (tenants) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <form onSubmit={handleTenantSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Sistema de Gestão Operacional</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Selecione a empresa</h1>
          <p className="mt-2 text-sm text-slate-400">Sua conta tem acesso a mais de uma empresa. Escolha em qual deseja entrar.</p>

          <div className="mt-6 space-y-2">
            {tenants.map((tenant) => (
              <label
                key={tenant.id}
                className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              >
                <input
                  type="radio"
                  name="tenant"
                  value={tenant.id}
                  checked={selectedTenantId === tenant.id}
                  onChange={() => setSelectedTenantId(tenant.id)}
                />
                {tenant.nome}
              </label>
            ))}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading || selectedTenantId == null}
            className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Continuar'}
          </button>

          <button
            type="button"
            onClick={handleBack}
            className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300"
          >
            Voltar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleCredentialsSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Sistema de Gestão Operacional</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Entrar</h1>
        <p className="mt-2 text-sm text-slate-400">Acesse com seu e-mail e senha corporativos.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-300" htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300" htmlFor="senha">Senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
