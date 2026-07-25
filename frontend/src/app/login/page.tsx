'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || 'Não foi possível entrar. Verifique suas credenciais.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8">
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
