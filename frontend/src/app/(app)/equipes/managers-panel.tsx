'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, TriangleAlert, UserCog } from 'lucide-react';
import { Alert, Button, cx } from '@/components/ui';

export type UsuarioDaEmpresa = { userId: number; nome: string; email: string; ativo: boolean; role: { nome: string } };

/**
 * Quem responde pela equipe.
 *
 * Não é rótulo decorativo: este vínculo é o que faz alguém sem permissão de
 * administrar a empresa enxergar a equipe (é o que torna o papel Líder
 * utilizável) e é para onde vão os alertas de férias do time. Por isso o painel
 * diz isso na cara, em vez de deixar a consequência escondida no backend.
 */
export function ManagersPanel({
  equipeId,
  equipeNome,
  atuais,
  usuarios,
  podeListarUsuarios,
}: {
  equipeId: number;
  equipeNome: string;
  atuais: Array<{ gestor: { id: number; nome: string } }>;
  usuarios: UsuarioDaEmpresa[];
  podeListarUsuarios: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>(atuais.map((item) => item.gestor.id));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const elegiveis = usuarios.filter((usuario) => usuario.ativo);

  function alternar(userId: number) {
    setSelecionados((atual) =>
      atual.includes(userId) ? atual.filter((id) => id !== userId) : [...atual, userId]
    );
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/equipes/${equipeId}/gestores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestorIds: selecionados }),
      });

      if (!response.ok) {
        const dados = await response.json().catch(() => ({}));
        setErro(dados.error || 'Não foi possível salvar os responsáveis.');
        return;
      }

      setAberto(false);
      router.refresh();
    } catch {
      setErro('Falha de comunicação ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
        <UserCog size={14} /> Responsáveis
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-line bg-surface-raised p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <ShieldCheck size={14} className="shrink-0 text-accent" />
        Quem responde por {equipeNome}
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
        Quem for marcado passa a enxergar esta equipe mesmo sem administrar a empresa, e recebe os alertas de férias
        do time.
      </p>

      {!podeListarUsuarios ? (
        // Um papel customizado pode ter `team.edit` sem `user.view`. Dizer qual
        // permissão falta é melhor que mostrar uma lista vazia sem explicação.
        <p className="mt-3 text-xs text-ink-subtle">
          Para escolher responsáveis é preciso também a permissão de ver usuários da empresa. Peça a um
          administrador.
        </p>
      ) : elegiveis.length === 0 ? (
        <p className="mt-3 text-xs text-ink-subtle">
          Nenhum usuário ativo nesta empresa. Convide alguém em Usuários e papéis primeiro.
        </p>
      ) : (
        <div className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {elegiveis.map((usuario) => {
            const marcado = selecionados.includes(usuario.userId);
            return (
              <label
                key={usuario.userId}
                className={cx(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                  marcado ? 'border-accent/40 bg-accent-soft' : 'border-transparent hover:bg-surface-hover'
                )}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(usuario.userId)}
                  className="h-4 w-4 shrink-0 rounded border-line accent-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink">{usuario.nome}</span>
                  <span className="block truncate text-2xs text-ink-subtle">{usuario.email}</span>
                </span>
                <span className="shrink-0 text-2xs text-ink-subtle">{usuario.role.nome}</span>
              </label>
            );
          })}
        </div>
      )}

      {selecionados.length === 0 && elegiveis.length > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-warn">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          Sem responsável, os alertas de férias desta equipe não chegam a ninguém — só ao RH, se houver.
        </p>
      ) : null}

      {erro ? (
        <div className="mt-2">
          <Alert tone="danger">{erro}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAberto(false)} disabled={salvando}>
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
