'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Share2, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { SHARE_ACCESS_LABELS, SHARE_SCOPE_LABELS } from '@/lib/widgets';

type Concessao = {
  id: number;
  escopo: string;
  acesso: string;
  token: string | null;
  expiraEm: string | null;
  usuario: { id: number; nome: string; email: string } | null;
  equipe: { id: number; nome: string } | null;
  papel: { id: number; nome: string } | null;
  criadoPor: { id: number; nome: string } | null;
};

type Opcao = { id: number; nome: string };

function destinatario(concessao: Concessao) {
  if (concessao.usuario) return concessao.usuario.nome;
  if (concessao.equipe) return concessao.equipe.nome;
  if (concessao.papel) return concessao.papel.nome;
  if (concessao.escopo === 'link_publico') return 'Quem tiver o link';
  if (concessao.escopo === 'plataforma') return 'Todas as empresas';
  return 'Todos da empresa';
}

export function SharePanel({ dashboardId }: { dashboardId: number }) {
  const [aberto, setAberto] = useState(false);
  const [concessoes, setConcessoes] = useState<Concessao[]>([]);
  const [usuarios, setUsuarios] = useState<Opcao[]>([]);
  const [equipes, setEquipes] = useState<Opcao[]>([]);
  const [papeis, setPapeis] = useState<Opcao[]>([]);
  const [escopo, setEscopo] = useState('usuario');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const response = await fetch(`/api/dashboards/${dashboardId}/compartilhamentos`);
    if (response.ok) setConcessoes(await response.json());
  }, [dashboardId]);

  useEffect(() => {
    if (!aberto) return;

    carregar();

    // Os destinatários possíveis só são necessários com o painel aberto.
    Promise.all([
      fetch('/api/usuarios').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/equipes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/papeis').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([usuariosData, equipesData, papeisData]) => {
        // /api/usuarios devolve o vínculo com o tenant, e a chave do usuário ali
        // é `userId` — não `id`, que pertenceria à linha de vínculo.
        setUsuarios(
          Array.isArray(usuariosData)
            ? usuariosData.map((item: { userId: number; nome: string }) => ({ id: item.userId, nome: item.nome }))
            : []
        );
        setEquipes(Array.isArray(equipesData) ? equipesData.map((item: Opcao) => ({ id: item.id, nome: item.nome })) : []);
        setPapeis(Array.isArray(papeisData) ? papeisData.map((item: Opcao) => ({ id: item.id, nome: item.nome })) : []);
      })
      .catch(() => undefined);
  }, [aberto, carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const alvo = String(formData.get('alvo') || '');
    const payload: Record<string, unknown> = {
      escopo,
      acesso: escopo === 'link_publico' ? 'leitura' : String(formData.get('acesso') || 'leitura'),
    };
    if (escopo === 'usuario') payload.usuarioId = Number(alvo);
    if (escopo === 'equipe') payload.equipeId = Number(alvo);
    if (escopo === 'papel') payload.papelId = Number(alvo);

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/compartilhamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível compartilhar');
        return;
      }

      await carregar();
    } catch {
      setError('Falha de comunicação. Recarregue para conferir se o compartilhamento foi criado.');
    } finally {
      setPending(false);
    }
  }

  async function revogar(shareId: number) {
    setPending(true);
    try {
      await fetch(`/api/dashboards/${dashboardId}/compartilhamentos/${shareId}`, { method: 'DELETE' });
      await carregar();
    } finally {
      setPending(false);
    }
  }

  async function copiarLink(concessao: Concessao) {
    if (!concessao.token) return;
    const url = `${window.location.origin}/d/${concessao.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(concessao.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Área de transferência bloqueada pelo navegador: o link continua visível abaixo.
      setError(url);
    }
  }

  if (!aberto) {
    return (
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={() => setAberto(true)}>
          <Share2 size={14} /> Compartilhar
        </Button>
      </div>
    );
  }

  const opcoesAlvo = escopo === 'usuario' ? usuarios : escopo === 'equipe' ? equipes : papeis;
  const precisaAlvo = escopo === 'usuario' || escopo === 'equipe' || escopo === 'papel';

  return (
    <Card className="mt-4">
      <CardHeader
        title="Compartilhamento"
        description="Quem alcança este painel — por pessoa, equipe, papel, empresa inteira ou link público."
        action={
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
          <Field label="Compartilhar com" htmlFor="escopo">
            <Select id="escopo" value={escopo} onChange={(event) => setEscopo(event.target.value)}>
              <option value="usuario">Uma pessoa</option>
              <option value="equipe">Uma equipe</option>
              <option value="papel">Um papel</option>
              <option value="tenant">Toda a empresa</option>
              <option value="link_publico">Link público (wallboard)</option>
            </Select>
          </Field>

          {precisaAlvo ? (
            <Field label="Destinatário" htmlFor="alvo">
              <Select id="alvo" name="alvo" required defaultValue="">
                <option value="" disabled>
                  Selecione...
                </option>
                {opcoesAlvo.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Field
            label="Nível de acesso"
            htmlFor="acesso"
            hint={escopo === 'link_publico' ? 'Link público é sempre leitura' : undefined}
          >
            <Select id="acesso" name="acesso" defaultValue="leitura" disabled={escopo === 'link_publico'}>
              <option value="leitura">Somente leitura</option>
              <option value="edicao">Pode editar</option>
              <option value="gestao">Pode administrar</option>
            </Select>
          </Field>

          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={pending} className="w-full">
              {pending ? 'Salvando...' : 'Compartilhar'}
            </Button>
          </div>

          {error ? (
            <div className="sm:col-span-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </form>
      </CardBody>

      {concessoes.length > 0 ? (
        <div className="divide-y divide-line border-t border-line">
          {concessoes.map((concessao) => (
            <div key={concessao.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm text-ink">
                  {concessao.escopo === 'link_publico' ? <Link2 size={13} className="shrink-0 text-ink-subtle" /> : null}
                  {destinatario(concessao)}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {SHARE_SCOPE_LABELS[concessao.escopo] ?? concessao.escopo}
                  {concessao.criadoPor ? ` · por ${concessao.criadoPor.nome}` : ''}
                  {concessao.expiraEm ? ` · expira em ${formatDate(concessao.expiraEm)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={concessao.acesso === 'leitura' ? 'neutral' : 'accent'}>
                  {SHARE_ACCESS_LABELS[concessao.acesso] ?? concessao.acesso}
                </Badge>
                {concessao.token ? (
                  <Button variant="ghost" size="sm" onClick={() => copiarLink(concessao)} title="Copiar link do wallboard">
                    <Copy size={13} /> {copiado === concessao.id ? 'Copiado' : 'Link'}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revogar(concessao.id)}
                  disabled={pending}
                  title="Revogar acesso"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-line px-4 py-6 text-center text-xs text-ink-subtle sm:px-5">
          Este painel ainda é só seu.
        </p>
      )}
    </Card>
  );
}
