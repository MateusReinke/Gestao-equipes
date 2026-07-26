'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogIn } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';

type TenantOption = { id: number; nome: string; slug: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[] | null>(null);
  const [tenantSelecionado, setTenantSelecionado] = useState<number | null>(null);

  async function autenticar(tenantId?: number) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, tenantId }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || 'Não foi possível entrar. Verifique suas credenciais.');
        return;
      }

      // Quem tem acesso a mais de uma empresa escolhe qual antes de entrar.
      if (payload.requiresTenantSelection) {
        setTenants(payload.tenants);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Não foi possível falar com o servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white">
            GO
          </span>
          <div>
            <p className="text-base font-semibold leading-tight text-ink">Gestão Operacional</p>
            <p className="text-xs text-ink-subtle">Equipes, escalas e plantões</p>
          </div>
        </div>

        <div className="card p-6">
          {tenants ? (
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                if (tenantSelecionado != null) autenticar(tenantSelecionado);
              }}
            >
              <h1 className="text-lg font-semibold text-ink">Selecione a empresa</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Sua conta tem acesso a mais de uma empresa. Escolha em qual deseja entrar agora.
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {tenants.map((tenant) => (
                  <label
                    key={tenant.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors ${
                      tenantSelecionado === tenant.id
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-raised text-ink hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tenant"
                      value={tenant.id}
                      checked={tenantSelecionado === tenant.id}
                      onChange={() => setTenantSelecionado(tenant.id)}
                      className="sr-only"
                    />
                    <Building2 size={16} className="shrink-0" />
                    <span className="truncate font-medium">{tenant.nome}</span>
                  </label>
                ))}
              </div>

              {error ? (
                <div className="mt-4">
                  <Alert tone="danger">{error}</Alert>
                </div>
              ) : null}

              <Button type="submit" variant="primary" disabled={loading || tenantSelecionado == null} className="mt-5 w-full">
                {loading ? 'Entrando...' : 'Continuar'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setTenants(null);
                  setTenantSelecionado(null);
                  setError(null);
                }}
                className="mt-3 w-full text-center text-xs text-ink-subtle transition-colors hover:text-ink"
              >
                Voltar
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                autenticar();
              }}
            >
              <h1 className="text-lg font-semibold text-ink">Entrar</h1>
              <p className="mt-1 text-sm text-ink-muted">Acesse com seu e-mail e senha corporativos.</p>

              <div className="mt-5 flex flex-col gap-4">
                <Field label="E-mail" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@empresa.com"
                  />
                </Field>

                <Field label="Senha" htmlFor="senha">
                  <Input
                    id="senha"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                  />
                </Field>
              </div>

              {error ? (
                <div className="mt-4">
                  <Alert tone="danger">{error}</Alert>
                </div>
              ) : null}

              <Button type="submit" variant="primary" disabled={loading} className="mt-5 w-full">
                <LogIn size={15} /> {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
