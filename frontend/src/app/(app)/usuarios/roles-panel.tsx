'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';

export type Papel = {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  isSystem: boolean;
  tenantId: number | null;
  permissoes: string[];
};

export type Permissao = { id: number; codigo: string; descricao: string; categoria: string };

function agruparPorCategoria(permissoes: Permissao[]) {
  const mapa = new Map<string, Permissao[]>();
  for (const permissao of permissoes) {
    const lista = mapa.get(permissao.categoria) ?? [];
    lista.push(permissao);
    mapa.set(permissao.categoria, lista);
  }
  return [...mapa.entries()];
}

export function RolesPanel({
  papeis,
  permissoes,
  podeAdministrar,
}: {
  papeis: Papel[];
  permissoes: Permissao[];
  podeAdministrar: boolean;
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  function alternar(codigo: string) {
    setSelecionadas((atual) => (atual.includes(codigo) ? atual.filter((item) => item !== codigo) : [...atual, codigo]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get('nome') || ''),
      descricao: String(formData.get('descricao') || ''),
      permissoes: selecionadas,
    };

    try {
      const response = await fetch('/api/papeis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível criar o papel');
        return;
      }

      setCriando(false);
      setSelecionadas([]);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Falha de comunicação. Atualize a página para conferir.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader
        title="Papéis e permissões"
        description="Papéis padrão da plataforma não podem ser alterados. Crie um papel próprio da empresa para combinações específicas."
        action={
          podeAdministrar ? (
            <Button variant="secondary" size="sm" onClick={() => setCriando((atual) => !atual)}>
              <Plus size={14} /> {criando ? 'Cancelar' : 'Criar papel'}
            </Button>
          ) : null
        }
      />

      {criando && podeAdministrar ? (
        <CardBody className="border-b border-line">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do papel" htmlFor="nome">
                <Input id="nome" name="nome" required minLength={2} placeholder="Coordenador de plantão" />
              </Field>
              <Field label="Descrição" htmlFor="descricao">
                <Input id="descricao" name="descricao" required minLength={2} placeholder="Acompanha turnos e aprova trocas do próprio time." />
              </Field>
            </div>

            <div>
              <p className="eyebrow mb-2">Permissões ({selecionadas.length} selecionada(s))</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agruparPorCategoria(permissoes).map(([categoria, lista]) => (
                  <div key={categoria} className="rounded-lg border border-line bg-surface-raised p-3">
                    <p className="mb-2 text-xs font-medium text-ink">{categoria}</p>
                    <div className="flex flex-col gap-1.5">
                      {lista.map((permissao) => (
                        <label key={permissao.codigo} className="flex items-start gap-2 text-2xs text-ink-muted">
                          <input
                            type="checkbox"
                            checked={selecionadas.includes(permissao.codigo)}
                            onChange={() => alternar(permissao.codigo)}
                            className="mt-0.5 rounded border-line bg-bg"
                          />
                          <span>{permissao.descricao}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <Button type="submit" variant="primary" disabled={pending || selecionadas.length === 0}>
              {pending ? 'Criando...' : 'Criar papel'}
            </Button>
          </form>
        </CardBody>
      ) : null}

      <div className="divide-y divide-line">
        {papeis.map((papel) => (
          <div key={papel.id} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink">{papel.nome}</p>
              {papel.isSystem ? (
                <Badge tone="neutral">
                  <Lock size={10} /> padrão da plataforma
                </Badge>
              ) : (
                <Badge tone="accent">papel da empresa</Badge>
              )}
              <Badge tone="info">{papel.permissoes.length} permissões</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{papel.descricao}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
