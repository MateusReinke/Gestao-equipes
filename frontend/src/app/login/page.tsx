'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '');
    const senha = String(formData.get('senha') || '');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Falha ao autenticar');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Falha de comunicação com o servidor');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-center gap-2 text-sky-300">
          <ShieldCheck size={20} />
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Gestão Operacional</span>
        </div>
        <h1 className="mb-6 text-xl font-semibold text-white">Entrar</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoFocus className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor="senha">Senha</label>
            <input id="senha" name="senha" type="password" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
